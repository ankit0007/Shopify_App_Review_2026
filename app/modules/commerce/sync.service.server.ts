import {db} from '../../db.server';
import {encryptData} from '../../lib/encrypted-data.server';
import {createReviewToken} from '../../lib/tokens.server';
import {automaticRequestsEnabled, reviewableFulfilledLines, shopifyOrderId, type CommercePayload} from './fulfillment-lines';

export type ShopifyOrderPayload = CommercePayload & {
  customer?: {id?: number | string; email?: string; first_name?: string; last_name?: string} | null;
};

function resourceId(value: string) {
  return value.includes('/') ? value.split('/').at(-1) ?? value : value;
}

export function toOrderWebhookPayload(order: {
  id: string;
  name: string;
  displayFulfillmentStatus: string;
  customer: {id: string; email: string | null; firstName: string | null; lastName: string | null} | null;
  lineItems: {nodes: Array<{quantity: number; product: {id: string; title: string} | null}>};
  fulfillments: Array<{createdAt: string}>;
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
        where: {shopId_shopifyCustomerId: {shopId, shopifyCustomerId: String(payload.customer.id)}},
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
      where: {shopId_shopifyOrderId: {shopId, shopifyOrderId: shopifyOrder}},
      select: {customerId: true},
    });
    customerId = customerId ?? existingOrder?.customerId ?? undefined;

    const order = await tx.order.upsert({
      where: {shopId_shopifyOrderId: {shopId, shopifyOrderId: shopifyOrder}},
      update: {
        orderNumber: String(payload.order_number ?? ''),
        status: payload.fulfillment_status ?? payload.status,
        fulfillmentDate: payload.fulfilled_at ? new Date(payload.fulfilled_at) : fulfilledLines.size ? new Date() : undefined,
        ...(customerId ? {customerId} : {}),
      },
      create: {
        shopId,
        shopifyOrderId: shopifyOrder,
        orderNumber: String(payload.order_number ?? ''),
        status: payload.fulfillment_status ?? payload.status,
        fulfillmentDate: payload.fulfilled_at ? new Date(payload.fulfilled_at) : fulfilledLines.size ? new Date() : undefined,
        customerId,
      },
    });

    let queuedEmail = false;
    for (const item of payload.line_items ?? []) {
      if (!item.product_id || item.gift_card) continue;
      const shopifyProductId = String(item.product_id);
      if (!/^\d{1,20}$/.test(shopifyProductId)) continue;
      const fulfilled = fulfilledLines.get(shopifyProductId);
      const product = await tx.product.upsert({
        where: {shopId_shopifyProductId: {shopId, shopifyProductId}},
        update: {title: item.title ?? 'Untitled product'},
        create: {shopId, shopifyProductId, title: item.title ?? fulfilled?.title ?? 'Untitled product'},
      });
      const currentItem = await tx.orderItem.findUnique({
        where: {orderId_productId: {orderId: order.id, productId: product.id}},
        select: {fulfilledQuantity: true},
      });
      const fulfilledQuantity = Math.max(currentItem?.fulfilledQuantity ?? 0, fulfilled?.quantity ?? 0);
      await tx.orderItem.upsert({
        where: {orderId_productId: {orderId: order.id, productId: product.id}},
        update: {quantity: item.quantity ?? 1, fulfilledQuantity},
        create: {orderId: order.id, productId: product.id, quantity: item.quantity ?? 1, fulfilledQuantity},
      });

      if (!fulfilled || !customerId) continue;
      const shop = await tx.shop.findUnique({where: {id: shopId}, select: {uninstalledAt: true, settings: {select: {automaticRequests: true, requestDelayDays: true, requestExpirationDays: true}}}});
      if (shop?.uninstalledAt || !automaticRequestsEnabled(shop?.settings?.automaticRequests)) continue;
      const optedOut = await tx.consent.findFirst({
        where: {shopId, customerId, purpose: 'review_request', granted: false},
        select: {id: true},
      });
      if (optedOut) continue;
      const reviewed = await tx.review.findFirst({
        where: {shopId, productId: product.id, customerId, deletedAt: null},
        select: {id: true},
      });
      if (reviewed) continue;
      const existing = await tx.reviewRequest.findFirst({
        where: {shopId, orderId: order.id, productId: product.id, customerId},
        select: {id: true},
      });
      if (existing) continue;
      const reviewToken = createReviewToken();
      const scheduledAt = new Date(Date.now() + (shop?.settings?.requestDelayDays ?? 7) * 86_400_000);
      const expiresAt = new Date(scheduledAt.getTime() + (shop?.settings?.requestExpirationDays ?? 30) * 86_400_000);
      await tx.reviewRequest.create({
        data: {
          shopId,
          orderId: order.id,
          productId: product.id,
          customerId,
          tokenHash: reviewToken.tokenHash,
          tokenEncrypted: encryptData(reviewToken.token),
          status: queuedEmail ? 'PENDING' : 'SCHEDULED',
          scheduledAt,
          expiresAt,
        },
      });
      queuedEmail = true;
    }
  });
}
