import {db} from '../../db.server';

export async function verifyPurchase(input: {
  shopId: string;
  orderId: string;
  productId: string;
  customerId?: string;
}) {
  const item = await db.orderItem.findFirst({
    where: {
      orderId: input.orderId,
      productId: input.productId,
      order: {
        shopId: input.shopId,
        status: 'fulfilled',
        ...(input.customerId ? {customerId: input.customerId} : {}),
      },
    },
    select: {id: true},
  });
  return Boolean(item);
}
