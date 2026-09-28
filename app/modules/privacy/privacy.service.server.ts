import {db} from '../../db.server';

export async function collectCustomerData(shopId: string, shopifyCustomerId: string) {
  const customer = await db.customer.findFirst({
    where: {shopId, shopifyCustomerId},
    select: {
      displayName: true,
      orders: {select: {shopifyOrderId: true, orderNumber: true, createdAt: true}},
      reviews: {select: {rating: true, title: true, body: true, submittedAt: true}},
      consents: {select: {purpose: true, granted: true, createdAt: true}},
    },
  });
  return customer;
}

export async function eraseCustomerData(shopId: string, shopifyCustomerId: string) {
  const customer = await db.customer.findFirst({
    where: {shopId, shopifyCustomerId},
    select: {id: true},
  });
  if (!customer) return {customerDeleted: 0, reviewsAnonymized: 0, requestsDeleted: 0};
  return db.$transaction(async (tx) => {
    const reviews = await tx.review.updateMany({
      where: {shopId, customerId: customer.id},
      data: {
        customerId: null,
        displayName: 'Customer',
        orderId: null,
        verificationReason: 'Customer data redacted',
      },
    });
    const requests = await tx.reviewRequest.deleteMany({
      where: {shopId, customerId: customer.id},
    });
    await tx.consent.deleteMany({where: {shopId, customerId: customer.id}});
    const deleted = await tx.customer.deleteMany({where: {id: customer.id}});
    return {customerDeleted: deleted.count, reviewsAnonymized: reviews.count, requestsDeleted: requests.count};
  });
}
