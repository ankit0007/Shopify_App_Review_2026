import {db} from './db.server';
import {config} from './config.server';
import {decryptData} from './lib/encrypted-data.server';
import {syncOrderWebhook, type ShopifyOrderPayload} from './modules/commerce/sync.service.server';
import {createEmailService} from './modules/email/email.service.server';

/**
 * Worker entrypoint. A production deployment should run this process under a
 * supervisor and connect the polling hooks to Redis/BullMQ or another durable
 * queue. Work is intentionally idempotent and never runs in a request.
 */
export async function processDueReviewRequests(now = new Date()) {
  const emailService = createEmailService();
  const reminderCandidates = await db.reviewRequest.findMany({
    where: {
      status: {in: ['SENT', 'OPENED']},
      sentAt: {not: null, lte: new Date(now.getTime() - 86_400_000)},
      expiresAt: {gt: now},
    },
    include: {shop: {include: {settings: true}}},
    take: 100,
  });
  for (const request of reminderCandidates) {
    const settings = request.shop.settings;
    if (!settings || request.reminderCount >= settings.maxReminders) continue;
    const dueAt = new Date(request.sentAt!.getTime() + settings.reminderDelayDays * 86_400_000);
    if (dueAt > now) continue;
    await db.reviewRequest.updateMany({
      where: {id: request.id, status: {in: ['SENT', 'OPENED']}, reminderCount: request.reminderCount},
      data: {status: 'SCHEDULED', scheduledAt: now, reminderCount: {increment: 1}},
    });
  }
  await db.reviewRequest.updateMany({
    where: {status: {in: ['SCHEDULED', 'SENT']}, expiresAt: {lt: now}},
    data: {status: 'EXPIRED'},
  });
  const due = await db.reviewRequest.findMany({
    where: {status: 'SCHEDULED', scheduledAt: {lte: now}},
    include: {customer: true, product: true},
    take: 100,
  });
  for (const request of due) {
    const claimed = await db.reviewRequest.updateMany({
      where: {id: request.id, status: 'SCHEDULED'},
      data: {status: 'SENDING'},
    });
    if (claimed.count !== 1) continue;
    try {
      if (!request.customer?.emailEncrypted || !request.tokenEncrypted) {
        throw new Error('Review request has no deliverable recipient or token');
      }
      const recipient = decryptData(request.customer.emailEncrypted);
      const token = decryptData(request.tokenEncrypted);
      const provider = await emailService.send({
        to: recipient,
        subject: `How was your ${request.product?.title ?? 'purchase'}?`,
        html: `<p>We would love your feedback on ${request.product?.title ?? 'your purchase'}.</p><p><a href="${config.SHOPIFY_APP_URL}/review/${encodeURIComponent(token)}">Share your review</a></p>`,
      });
      await db.reviewRequest.updateMany({
        where: {id: request.id, status: 'SENDING'},
        data: {status: 'SENT', sentAt: now},
      });
      await db.emailEvent.create({
        data: {shopId: request.shopId, reviewRequestId: request.id, eventType: 'SENT', providerId: provider.providerId},
      });
    } catch (error) {
      await db.reviewRequest.updateMany({
        where: {id: request.id, status: 'SENDING'},
        data: {
          status: 'FAILED',
          lastError: error instanceof Error ? error.message : 'Email delivery unavailable',
        },
      });
      await db.emailEvent.create({
        data: {
          shopId: request.shopId,
          reviewRequestId: request.id,
          eventType: 'FAILED',
          errorCode: error instanceof Error ? error.message : 'EMAIL_DELIVERY_FAILED',
        },
      });
    }
  }
}

async function processWebhookEvents() {
  const events = await db.webhookEvent.findMany({
    where: {processedAt: null, failedAt: null},
    orderBy: {createdAt: 'asc'},
    take: 100,
  });
  for (const event of events) {
    try {
      // Commerce synchronization handlers are intentionally idempotent and
      // belong here, outside the webhook acknowledgement request.
      if (event.shopId && ['orders/create', 'orders/updated'].includes(event.topic)) {
        await syncOrderWebhook(event.shopId, event.payload as ShopifyOrderPayload);
      }
      await db.webhookEvent.update({
        where: {id: event.id},
        data: {processedAt: new Date()},
      });
    } catch (error) {
      await db.webhookEvent.update({
        where: {id: event.id},
        data: {failedAt: new Date(), errorMessage: error instanceof Error ? error.message : 'Unknown worker error'},
      });
    }
  }
}

await processDueReviewRequests();
await processWebhookEvents();
await db.$disconnect();
