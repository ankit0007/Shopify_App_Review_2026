import { db } from '../../db.server';
import { encryptData } from '../../lib/encrypted-data.server';
import { createReviewToken } from '../../lib/tokens.server';
import { automaticRequestsEnabled, fulfillmentMoment, latestFulfillmentMoment, linesForReviewEmail, orderEmailAlreadySent, orderIsPaid, planOrderReviewEmail, reviewableFulfilledLines, reviewEmailTrigger, reviewSendAt, shopifyOrderId, type CommercePayload } from './fulfillment-lines';

export type ShopifyOrderPayload = CommercePayload & {
  customer?: { id?: number | string; email?: string; first_name?: string; last_name?: string } | null;
};

function resourceId(value: string) {
  return value.includes('/') ? value.split('/').at(-1) ?? value : value;
}

export function toOrderWebhookPayload(order: {
  id: string;
  name: string;
  displayFulfillmentStatus: string;
  customer: { id: string; email: string | null; firstName: string | null; lastName: string | null } | null;
  lineItems: { nodes: Array<{ quantity: number; product: { id: string; title: string } | null }> };
  fulfillments: Array<{ createdAt: string }>;
}): ShopifyOrderPayload {
  return {
    id: resourceId(order.id),
    order_number: Number(order.name.replace(/\D/g, '')) || undefined,
    fulfillment_status: order.displayFulfillmentStatus.toLowerCase(),
    fulfilled_at: order.fulfillments[0]?.createdAt ?? null,
    customer: order.customer ? {
      id: resourceId(order.customer.id),
      email: order.customer.email ?? undefined,
      first_name: order.customer.firstName ?? undefined,
      last_name: order.customer.lastName ?? undefined,
    } : null,
    line_items: order.lineItems.nodes.flatMap((item) => item.product ? [{
      product_id: resourceId(item.product.id),
      title: item.product.title,
      quantity: item.quantity,
    }] : []),
  };
}

export async function syncOrderWebhook(shopId: string, payload: ShopifyOrderPayload) {
  const shopifyOrder = shopifyOrderId(payload);
  if (!shopifyOrder) return;
  const fulfilledLines = new Map(reviewableFulfilledLines(payload).map((line) => [line.productId, line]));
  await db.$transaction(async (tx) => {
    let customerId: string | undefined;
    if (payload.customer?.id) {
      const customer = await tx.customer.upsert({
        where: { shopId_shopifyCustomerId: { shopId, shopifyCustomerId: String(payload.customer.id) } },
        update: {
          displayName: [payload.customer.first_name, payload.customer.last_name].filter(Boolean).join(' ') || undefined,
          emailEncrypted: payload.customer.email ? encryptData(payload.customer.email.toLowerCase()) : undefined,
        },
        create: {
          shopId,
          shopifyCustomerId: String(payload.customer.id),
          displayName: [payload.customer.first_name, payload.customer.last_name].filter(Boolean).join(' ') || undefined,
          emailEncrypted: payload.customer.email ? encryptData(payload.customer.email.toLowerCase()) : undefined,
        },
      });
      customerId = customer.id;
    }

    const existingOrder = await tx.order.findUnique({
      where: { shopId_shopifyOrderId: { shopId, shopifyOrderId: shopifyOrder } },
      select: { customerId: true, fulfillmentDate: true, financialStatus: true, paidAt: true },
    });
    customerId = customerId ?? existingOrder?.customerId ?? undefined;
    const incomingFulfillment = fulfilledLines.size ? fulfillmentMoment(payload) : null;
    const fulfillmentDate = incomingFulfillment
      ? latestFulfillmentMoment(existingOrder?.fulfillmentDate, incomingFulfillment)
      : undefined;
    const incomingFinancialStatus = typeof payload.financial_status === 'string' ? payload.financial_status : undefined;
    const paid = orderIsPaid(incomingFinancialStatus) || orderIsPaid(existingOrder?.financialStatus);
    const paidAt = paid ? existingOrder?.paidAt ?? new Date() : undefined;

    const order = await tx.order.upsert({
      where: { shopId_shopifyOrderId: { shopId, shopifyOrderId: shopifyOrder } },
      update: {
        orderNumber: String(payload.order_number ?? ''),
        status: payload.fulfillment_status ?? payload.status,
        ...(incomingFinancialStatus ? { financialStatus: incomingFinancialStatus } : {}),
        ...(paidAt && !existingOrder?.paidAt ? { paidAt } : {}),
        ...(fulfillmentDate ? { fulfillmentDate } : {}),
        ...(customerId ? { customerId } : {}),
      },
      create: {
        shopId,
        shopifyOrderId: shopifyOrder,
        orderNumber: String(payload.order_number ?? ''),
        status: payload.fulfillment_status ?? payload.status,
        financialStatus: incomingFinancialStatus,
        paidAt,
        fulfillmentDate,
        customerId,
      },
    });

    const shop = await tx.shop.findUnique({
      where: { id: shopId },
      select: { uninstalledAt: true, settings: { select: { automaticRequests: true, reviewRequestTrigger: true, requestDelayDays: true, requestExpirationDays: true } } },
    });
    const trigger = reviewEmailTrigger(shop?.settings?.reviewRequestTrigger);
    const emailLines = new Map(linesForReviewEmail(payload, trigger, paid).map((line) => [line.productId, line]));
    const automatic = !shop?.uninstalledAt && automaticRequestsEnabled(shop?.settings?.automaticRequests);
    const scheduledAt = reviewSendAt(
      trigger === 'PAID' ? paidAt ?? new Date() : fulfillmentDate ?? incomingFulfillment ?? new Date(),
      shop?.settings?.requestDelayDays,
    );
    const expiresAt = new Date(scheduledAt.getTime() + (shop?.settings?.requestExpirationDays ?? 30) * 86_400_000);
    const orderRequests = customerId ? await tx.reviewRequest.findMany({
      where: { shopId, orderId: order.id, customerId },
      select: { id: true, productId: true, status: true, sentAt: true },
    }) : [];
    const emailAlreadySent = orderEmailAlreadySent(orderRequests);
    let hasWaitingAnchor = orderRequests.some((request) => request.status === 'SCHEDULED' || request.status === 'FAILED');

    for (const item of payload.line_items ?? []) {
      if (!item.product_id || item.gift_card) continue;
      const shopifyProductId = String(item.product_id);
      if (!/^\d{1,20}$/.test(shopifyProductId)) continue;
      const fulfilled = fulfilledLines.get(shopifyProductId);
      const product = await tx.product.upsert({
        where: { shopId_shopifyProductId: { shopId, shopifyProductId } },
        update: { title: item.title ?? 'Untitled product' },
        create: { shopId, shopifyProductId, title: item.title ?? fulfilled?.title ?? 'Untitled product' },
      });
      const currentItem = await tx.orderItem.findUnique({
        where: { orderId_productId: { orderId: order.id, productId: product.id } },
        select: { fulfilledQuantity: true },
      });
      const fulfilledQuantity = Math.max(currentItem?.fulfilledQuantity ?? 0, fulfilled?.quantity ?? 0);
      await tx.orderItem.upsert({
        where: { orderId_productId: { orderId: order.id, productId: product.id } },
        update: { quantity: item.quantity ?? 1, fulfilledQuantity },
        create: { orderId: order.id, productId: product.id, quantity: item.quantity ?? 1, fulfilledQuantity },
      });

      if (!emailLines.has(shopifyProductId) || !customerId) continue;
      const optedOut = await tx.consent.findFirst({
        where: { shopId, customerId, purpose: 'review_request', granted: false },
        select: { id: true },
      });
      const reviewed = await tx.review.findFirst({
        where: { shopId, productId: product.id, customerId, deletedAt: null },
        select: { id: true },
      });
      const existing = orderRequests.find((request) => request.productId === product.id);
      const plan = planOrderReviewEmail({
        automatic: automatic && !optedOut && !reviewed,
        emailAlreadySent,
        hasWaitingAnchor,
        productAlreadyRequested: Boolean(existing),
      });
      if (plan === 'skip' || plan === 'keep' || plan === 'reschedule') continue;
      const reviewToken = createReviewToken();
      await tx.reviewRequest.create({
        data: {
          shopId,
          orderId: order.id,
          productId: product.id,
          customerId,
          tokenHash: reviewToken.tokenHash,
          tokenEncrypted: encryptData(reviewToken.token),
          status: plan === 'schedule' ? 'SCHEDULED' : 'PENDING',
          scheduledAt: plan === 'schedule' ? scheduledAt : null,
          expiresAt,
        },
      });
      if (plan === 'schedule') hasWaitingAnchor = true;
      orderRequests.push({ id: reviewToken.tokenHash, productId: product.id, status: plan === 'schedule' ? 'SCHEDULED' : 'PENDING', sentAt: null });
    }

    if (automatic && customerId && emailLines.size > 0 && !emailAlreadySent) {
      const waiting = await tx.reviewRequest.findMany({
        where: { shopId, orderId: order.id, customerId, status: { in: ['SCHEDULED', 'FAILED', 'PENDING'] } },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      const [anchor, ...rest] = waiting;
      if (anchor) {
        await tx.reviewRequest.update({
          where: { id: anchor.id },
          data: { status: 'SCHEDULED', scheduledAt, expiresAt, lastError: null },
        });
      }
      if (rest.length > 0) {
        await tx.reviewRequest.updateMany({
          where: { id: { in: rest.map((request) => request.id) }, status: { in: ['SCHEDULED', 'FAILED'] } },
          data: { status: 'PENDING', scheduledAt: null, lastError: null },
        });
      }
    }
  });
}
