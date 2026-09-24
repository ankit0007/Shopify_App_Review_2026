import {db} from './db.server';
import {syncOrderWebhook, type ShopifyOrderPayload} from './modules/commerce/sync.service.server';
import {DisabledEmailService} from './modules/email/email.service.server';

/**
 * Worker entrypoint. A production deployment should run this process under a
 * supervisor and connect the polling hooks to Redis/BullMQ or another durable
 * queue. Work is intentionally idempotent and never runs in a request.
 */
async function processDueReviewRequests() {
  const emailService = new DisabledEmailService();
  const due = await db.reviewRequest.findMany({
    where: {status: 'SCHEDULED', scheduledAt: {lte: new Date()}},
    take: 100,
  });
  for (const request of due) {
    try {
      // Customer email delivery is intentionally blocked until a configured
      // provider and consent-safe recipient lookup are available.
      await emailService.send({
        to: '',
        subject: 'Review request',
        html: '',
      });
      await db.reviewRequest.updateMany({
        where: {id: request.id, status: 'SCHEDULED'},
        data: {status: 'SENT', sentAt: new Date()},
      });
    } catch (error) {
      await db.reviewRequest.updateMany({
        where: {id: request.id, status: 'SCHEDULED'},
        data: {
          status: 'FAILED',
          lastError: error instanceof Error ? error.message : 'Email delivery unavailable',
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
