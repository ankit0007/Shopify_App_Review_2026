import {db} from '../../db.server';
import {encryptData} from '../../lib/encrypted-data.server';
import {createReviewToken} from '../../lib/tokens.server';

export type ShopifyOrderPayload = {
  id?: number | string;
  order_number?: number;
  fulfillment_status?: string | null;
  fulfilled_at?: string | null;
  customer?: {id?: number | string; email?: string; first_name?: string; last_name?: string} | null;
  line_items?: Array<{product_id?: number | string; title?: string; quantity?: number}>;
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
  if (!payload.id) return;
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

    const order = await tx.order.upsert({
      where: {shopId_shopifyOrderId: {shopId, shopifyOrderId: String(payload.id)}},
      update: {
        orderNumber: String(payload.order_number ?? ''),
        status: payload.fulfillment_status,
        fulfillmentDate: payload.fulfilled_at
          ? new Date(payload.fulfilled_at)
          : payload.fulfillment_status === 'fulfilled' ? new Date() : undefined,
      },
      create: {
        shopId,
        shopifyOrderId: String(payload.id),
        orderNumber: String(payload.order_number ?? ''),
        status: payload.fulfillment_status,
        fulfillmentDate: payload.fulfilled_at
          ? new Date(payload.fulfilled_at)
          : payload.fulfillment_status === 'fulfilled' ? new Date() : undefined,
        customerId,
      },
    });

    for (const item of payload.line_items ?? []) {
      if (!item.product_id) continue;
      const product = await tx.product.upsert({
        where: {shopId_shopifyProductId: {shopId, shopifyProductId: String(item.product_id)}},
        update: {title: item.title ?? 'Untitled product'},
        create: {shopId, shopifyProductId: String(item.product_id), title: item.title ?? 'Untitled product'},
      });
      await tx.orderItem.upsert({
        where: {orderId_productId: {orderId: order.id, productId: product.id}},
        update: {quantity: item.quantity ?? 1},
        create: {orderId: order.id, productId: product.id, quantity: item.quantity ?? 1},
      });

      if (payload.fulfillment_status !== 'fulfilled' || !customerId) continue;
      const shop = await tx.shop.findUnique({where: {id: shopId}, select: {uninstalledAt: true}});
      if (shop?.uninstalledAt) continue;
      const settings = await tx.shopSettings.findUnique({where: {shopId}});
      if (settings?.automaticRequests === false) continue;
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
      const scheduledAt = new Date(Date.now() + (settings?.requestDelayDays ?? 7) * 86_400_000);
      const expiresAt = new Date(scheduledAt.getTime() + (settings?.requestExpirationDays ?? 30) * 86_400_000);
      await tx.reviewRequest.create({
        data: {
          shopId,
          orderId: order.id,
          productId: product.id,
          customerId,
          tokenHash: reviewToken.tokenHash,
          tokenEncrypted: encryptData(reviewToken.token),
          status: 'SCHEDULED',
          scheduledAt,
          expiresAt,
        },
      });
    }
  });
}
