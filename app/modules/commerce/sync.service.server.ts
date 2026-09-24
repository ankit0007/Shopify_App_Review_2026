import {db} from '../../db.server';

export type ShopifyOrderPayload = {
  id?: number | string;
  order_number?: number;
  fulfillment_status?: string | null;
  customer?: {id?: number | string; email?: string; first_name?: string; last_name?: string} | null;
  line_items?: Array<{product_id?: number | string; title?: string; quantity?: number}>;
};

export async function syncOrderWebhook(shopId: string, payload: ShopifyOrderPayload) {
  if (!payload.id) return;
  await db.$transaction(async (tx) => {
    let customerId: string | undefined;
    if (payload.customer?.id) {
      const customer = await tx.customer.upsert({
        where: {shopId_shopifyCustomerId: {shopId, shopifyCustomerId: String(payload.customer.id)}},
        update: {displayName: [payload.customer.first_name, payload.customer.last_name].filter(Boolean).join(' ') || undefined},
        create: {
          shopId,
          shopifyCustomerId: String(payload.customer.id),
          displayName: [payload.customer.first_name, payload.customer.last_name].filter(Boolean).join(' ') || undefined,
        },
      });
      customerId = customer.id;
    }

    const order = await tx.order.upsert({
      where: {shopId_shopifyOrderId: {shopId, shopifyOrderId: String(payload.id)}},
      update: {orderNumber: String(payload.order_number ?? ''), status: payload.fulfillment_status},
      create: {
        shopId,
        shopifyOrderId: String(payload.id),
        orderNumber: String(payload.order_number ?? ''),
        status: payload.fulfillment_status,
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
    }
  });
}
