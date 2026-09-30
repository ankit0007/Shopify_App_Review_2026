export type PurchaseRelationship = {
  shopId: string;
  orderShopId: string;
  orderStatus: string | null;
  orderCustomerId: string | null;
  customerId: string | null;
  lineProductId: string;
  reviewProductId: string;
};

export function purchaseMatchesReview(input: PurchaseRelationship & {lineFulfilled?: boolean}) {
  const fulfilled = input.orderStatus === 'fulfilled' || input.lineFulfilled === true;
  return Boolean(input.customerId) &&
    input.shopId === input.orderShopId &&
    fulfilled &&
    input.orderCustomerId === input.customerId &&
    input.lineProductId === input.reviewProductId;
}
