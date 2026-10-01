import { db } from './db.server';
import { config } from './config.server';
import { decryptData } from './lib/encrypted-data.server';
import { automaticRequestsEnabled, orderIsPaid, reviewEmailTrigger } from './modules/commerce/fulfillment-lines';
import { attachProductImages } from './modules/commerce/product-images.server';
import { displayOrderNumber } from './modules/email/template';
import { resolveReviewRecipient, PROTECTED_CUSTOMER_DATA_REASON } from './modules/reviews/request-test';
import { syncOrderWebhook, type ShopifyOrderPayload } from './modules/commerce/sync.service.server';
import { createDeliveryEmailService, deliverReviewEmail, loadEnabledSmtp } from './modules/email/delivery.server';
import { sanitizeSmtpError } from './modules/email/smtp-config';

function readEncrypted(value: string | null | undefined) {
  if (!value) return null;
  try {
    return decryptData(value);
  } catch {
    return null;
  }
}

/**
 * Worker entrypoint. A production deployment should run this process under a
 * supervisor and connect the polling hooks to Redis/BullMQ or another durable
 * queue. Work is intentionally idempotent and never runs in a request.
 */
export async function processDueReviewRequests(now = new Date()) {
  const emailService = await createDeliveryEmailService();
  const smtp = await loadEnabledSmtp();
  const reminderCandidates = await db.reviewRequest.findMany({
    where: {
      status: { in: ['SENT', 'OPENED'] },
      sentAt: { not: null, lte: new Date(now.getTime() - 86_400_000) },
      expiresAt: { gt: now },
    },
    include: { shop: { include: { settings: true } } },
    take: 100,
  });
  for (const request of reminderCandidates) {
    const settings = request.shop.settings;
    if (!settings || !automaticRequestsEnabled(settings.automaticRequests) || request.shop.uninstalledAt || request.reminderCount >= settings.maxReminders) continue;
    const dueAt = new Date(request.sentAt!.getTime() + settings.reminderDelayDays * 86_400_000);
    if (dueAt > now) continue;
    await db.reviewRequest.updateMany({
      where: { id: request.id, status: { in: ['SENT', 'OPENED'] }, reminderCount: request.reminderCount },
      data: { status: 'SCHEDULED', scheduledAt: now, reminderCount: { increment: 1 } },
    });
  }
  const expired = await db.reviewRequest.findMany({
    where: { status: { in: ['SCHEDULED', 'SENT', 'PENDING', 'OPENED'] }, expiresAt: { lt: now } },
    select: { id: true },
  });
  if (expired.length > 0) {
    const expiredIds = expired.map((request) => request.id);
    await db.reviewRequest.updateMany({
      where: { id: { in: expiredIds } },
      data: { status: 'EXPIRED' },
    });
    await db.emailDelivery.updateMany({
      where: { reviewRequestId: { in: expiredIds }, status: { in: ['QUEUED', 'PROCESSING', 'RETRYING'] } },
      data: { status: 'EXPIRED' },
    });
  }
  const due = await db.reviewRequest.findMany({
    where: {
      status: 'SCHEDULED',
      scheduledAt: { lte: now },
      shop: { uninstalledAt: null },
      OR: [
        { isTest: true },
        { shop: { settings: { is: { automaticRequests: true } } } },
      ],
    },
    include: { customer: true, product: true, order: true, shop: { include: { settings: true } } },
    take: 100,
  });
  for (const request of due) {
    const claimed = await db.reviewRequest.updateMany({
      where: { id: request.id, status: 'SCHEDULED' },
      data: { status: 'SENDING' },
    });
    if (claimed.count !== 1) continue;
    if (!request.isTest && !automaticRequestsEnabled(request.shop.settings?.automaticRequests)) {
      await db.reviewRequest.updateMany({
        where: { id: request.id, status: 'SENDING' },
        data: { status: 'SCHEDULED' },
      });
      continue;
    }
    const trigger = reviewEmailTrigger(request.shop.settings?.reviewRequestTrigger);
    if (request.orderId && request.customerId) {
      const earlierMail = await db.reviewRequest.findFirst({
        where: {
          shopId: request.shopId,
          orderId: request.orderId,
          customerId: request.customerId,
          id: { not: request.id },
          OR: [
            { status: { in: ['SENDING', 'SENT', 'OPENED', 'CLICKED', 'SUBMITTED'] } },
            { sentAt: { not: null } },
          ],
        },
        select: { id: true },
      });
      if (earlierMail) {
        await db.reviewRequest.updateMany({
          where: { id: request.id, status: 'SENDING' },
          data: { status: 'PENDING', scheduledAt: null, lastError: null },
        });
        continue;
      }
    }
    if (!request.isTest && trigger === 'PAID' && !orderIsPaid(request.order?.financialStatus)) {
      await db.reviewRequest.updateMany({
        where: { id: request.id, status: 'SENDING' },
        data: { status: 'PENDING', scheduledAt: null, lastError: 'Waiting until the order is paid' },
      });
      continue;
    }
    const [optedOut, existingReview, emailProducts] = await Promise.all([
      request.customerId ? db.consent.findFirst({
        where: { shopId: request.shopId, customerId: request.customerId, purpose: 'review_request', granted: false },
        select: { id: true },
      }) : null,
      request.customerId && request.productId ? db.review.findFirst({
        where: { shopId: request.shopId, customerId: request.customerId, productId: request.productId, deletedAt: null },
        select: { id: true },
      }) : null,
      request.orderId ? db.orderItem.findMany({
        where: {
          orderId: request.orderId,
          ...(request.isTest || trigger === 'PAID' ? { quantity: { gt: 0 } } : { fulfilledQuantity: { gt: 0 } }),
          product: { shopId: request.shopId },
        },
        select: { variantTitle: true, product: { select: { id: true, title: true, imageUrl: true, shopifyProductId: true } } },
      }) : Promise.resolve([]),
    ]);
    if (!emailProducts.length) {
      await db.reviewRequest.updateMany({
        where: { id: request.id, status: 'SENDING' },
        data: { status: 'CANCELLED', lastError: trigger === 'PAID' ? 'No purchased products remain' : 'No fulfilled products remain' },
      });
      continue;
    }
    if (request.shop.uninstalledAt || !request.product || optedOut || existingReview) {
      await db.reviewRequest.updateMany({
        where: { id: request.id, status: 'SENDING' },
        data: { status: 'CANCELLED', lastError: 'Request is no longer eligible' },
      });
      continue;
    }
    try {
      if (!request.tokenEncrypted) throw new Error('Review request has no token');
      const decision = resolveReviewRecipient({
        mode: request.isTest ? 'test' : 'automatic',
        customerEmail: readEncrypted(request.customer?.emailEncrypted),
        testRecipient: readEncrypted(request.testRecipientEncrypted),
      });
      if (!decision.ok) {
        await db.reviewRequest.updateMany({
          where: { id: request.id, status: 'SENDING' },
          data: { status: decision.blocked ? 'BLOCKED' : 'FAILED', lastError: decision.blocked ? PROTECTED_CUSTOMER_DATA_REASON : decision.reason },
        });
        continue;
      }
      const recipient = decision.recipient;
      const token = decryptData(request.tokenEncrypted);
      const listed = emailProducts.flatMap((item) => item.product ? [{...item.product, variantTitle: item.variantTitle}] : []);
      const withImages = await attachProductImages(request.shop.shopDomain, listed);
      const linkRows = request.orderId ? await db.reviewRequest.findMany({
        where: { shopId: request.shopId, orderId: request.orderId, tokenEncrypted: { not: '' } },
        select: { tokenEncrypted: true, product: { select: { shopifyProductId: true } } },
      }) : [];
      const reviewUrlFor = new Map(linkRows.flatMap((row) => {
        const productId = row.product?.shopifyProductId;
        const itemToken = readEncrypted(row.tokenEncrypted);
        return productId && itemToken ? [[productId, `${config.SHOPIFY_APP_URL}/review-request/${encodeURIComponent(itemToken)}#product-${productId}`] as const] : [];
      }));
      const products = withImages.map((product) => ({
        ...product,
        reviewUrl: reviewUrlFor.get(product.shopifyProductId) ?? `${config.SHOPIFY_APP_URL}/review-request/${encodeURIComponent(token)}#product-${product.shopifyProductId}`,
      }));
      const productName = products.map((product) => product.title).join(', ') || request.product.title;
      const customerName = request.customer?.displayName?.trim() || 'Customer';
      const result = await deliverReviewEmail({
        emailService,
        shopId: request.shopId,
        shopDomain: request.shop.name && !request.shop.name.includes('myshopify.com') ? request.shop.name : 'Artifyanni',
        reviewRequestId: request.id,
        reminderCount: request.reminderCount,
        recipient,
        productName,
        orderNumber: displayOrderNumber(request.order?.orderNumber ?? ''),
        customerName,
        products,
        reviewUrl: `${config.SHOPIFY_APP_URL}/review-request/${encodeURIComponent(token)}`,
        unsubscribeUrl: `${config.SHOPIFY_APP_URL}/unsubscribe/${encodeURIComponent(token)}`,
        secrets: smtp ? [smtp.password, smtp.username] : [],
      });
      if (result.status === 'ACCEPTED') {
        await db.reviewRequest.updateMany({
          where: { id: request.id, status: 'SENDING' },
          data: { status: 'SENT', sentAt: now, lastError: null },
        });
        await db.emailEvent.create({
          data: { shopId: request.shopId, reviewRequestId: request.id, eventType: 'ACCEPTED', providerId: result.providerId },
        });
      } else if (result.status === 'RETRYING') {
        await db.reviewRequest.updateMany({
          where: { id: request.id, status: 'SENDING' },
          data: { status: 'SCHEDULED', scheduledAt: result.nextAttemptAt, lastError: result.failureReason },
        });
      } else {
        await db.reviewRequest.updateMany({
          where: { id: request.id, status: 'SENDING' },
          data: { status: 'FAILED', lastError: result.failureReason },
        });
      }
    } catch (error) {
      const safeError = sanitizeSmtpError(error, smtp ? [smtp.password, smtp.username] : []);
      await db.reviewRequest.updateMany({
        where: { id: request.id, status: 'SENDING' },
        data: { status: 'FAILED', lastError: safeError },
      });
      await db.emailEvent.create({
        data: { shopId: request.shopId, reviewRequestId: request.id, eventType: 'FAILED', errorCode: safeError },
      });
    }
  }
}

async function processWebhookEvents() {
  const events = await db.webhookEvent.findMany({
    where: { processedAt: null, failedAt: null },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });
  for (const event of events) {
    try {
      // Commerce synchronization handlers are intentionally idempotent and
      // belong here, outside the webhook acknowledgement request.
      if (event.shopId && ['orders/create', 'orders/updated', 'orders/fulfilled', 'fulfillments/create'].includes(event.topic)) {
        await syncOrderWebhook(event.shopId, event.payload as ShopifyOrderPayload);
      }
      await db.webhookEvent.update({
        where: { id: event.id },
        data: { processedAt: new Date() },
      });
    } catch (error) {
      await db.webhookEvent.update({
        where: { id: event.id },
        data: { failedAt: new Date(), errorMessage: error instanceof Error ? error.message : 'Unknown worker error' },
      });
    }
  }
}

const workerEntry = process.argv[1]?.replace(/\\/g, '/');
const startedAsWorker = workerEntry?.endsWith('/app/worker.ts') || workerEntry?.endsWith('/app/worker.js');
if (startedAsWorker) {
const pollMs = Number(process.env.WORKER_POLL_MS ?? 60_000);
let stopping = false;
process.on('SIGTERM', () => {
  stopping = true;
});
process.on('SIGINT', () => {
  stopping = true;
});

while (!stopping) {
  await processDueReviewRequests();
  await processWebhookEvents();
  const started = Date.now();
  while (!stopping && Date.now() - started < pollMs) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

await db.$disconnect();
}
