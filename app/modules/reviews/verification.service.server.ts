import {db} from '../../db.server';
import {purchaseMatchesReview} from './purchase-match';

export async function verifyPurchase(input: {
  shopId: string;
  orderId: string;
  productId: string;
  customerId?: string;
}) {
  if (!input.customerId) return false;
  const item = await db.orderItem.findFirst({
    where: {
      orderId: input.orderId,
      productId: input.productId,
      product: {shopId: input.shopId},
    order: {
      shopId: input.shopId,
      customerId: input.customerId,
    },
  },
  select: {
    productId: true,
    fulfilledQuantity: true,
    order: {select: {shopId: true, status: true, customerId: true}},
  },
});
if (!item?.order) return false;
return purchaseMatchesReview({
  shopId: input.shopId,
  orderShopId: item.order.shopId,
  orderStatus: item.order.status,
  orderCustomerId: item.order.customerId,
  customerId: input.customerId,
  lineProductId: item.productId,
  reviewProductId: input.productId,
  lineFulfilled: item.fulfilledQuantity > 0,
});
}
