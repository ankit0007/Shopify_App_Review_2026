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
  return db.customer.deleteMany({where: {shopId, shopifyCustomerId}});
}
