import {db} from '../app/db.server';
import {config} from '../app/config.server';
import {decryptData} from '../app/lib/encrypted-data.server';
import {attachProductImages} from '../app/modules/commerce/product-images.server';
import {createDeliveryEmailService, deliverReviewEmail, loadEnabledSmtp, maskEmail} from '../app/modules/email/delivery.server';

const orderNumber = process.argv[2] || '1003';
const numbers = [orderNumber, `#${orderNumber}`, `TEST-${orderNumber}`];

const orders = await db.order.findMany({
  where: {orderNumber: {in: numbers}},
  include: {
    shop: true,
    customer: true,
    items: {include: {product: true}},
    reviewRequests: {orderBy: {createdAt: 'asc'}},
  },
});
const order = orders.find((item) => item.shop.shopDomain.includes('sftp-7qtjiorq')) ?? orders[0];
if (!order) {
  console.log(`order_missing=${orderNumber}`);
  process.exit(1);
}
const request = order.reviewRequests.find((item) => item.tokenEncrypted && item.status !== 'CANCELLED' && item.status !== 'EXPIRED')
  ?? order.reviewRequests.find((item) => item.tokenEncrypted);
if (!request || !order.customer?.emailEncrypted) {
  console.log(`order=${order.orderNumber} deliverable=no requests=${order.reviewRequests.length}`);
  process.exit(1);
}

await db.smtpConfiguration.update({where: {id: 'platform'}, data: {fromName: 'Artifyanni'}});
const products = await attachProductImages(
  order.shop.shopDomain,
  order.items.flatMap((item) => item.product && item.quantity > 0 ? [item.product] : []),
);
const smtp = await loadEnabledSmtp();
const emailService = await createDeliveryEmailService();
if (!smtp || !emailService) {
  console.log('email_not_configured');
  process.exit(1);
}
const result = await deliverReviewEmail({
  emailService,
  shopId: order.shopId,
  shopDomain: order.shop.name || 'Artifyanni',
  reviewRequestId: request.id,
  reminderCount: request.reminderCount,
  recipient: decryptData(order.customer.emailEncrypted),
  productName: products.map((product) => product.title).join(', '),
  orderNumber: order.orderNumber ?? orderNumber,
  customerName: order.customer.displayName?.trim() || 'there',
  products,
  reviewUrl: `${config.SHOPIFY_APP_URL}/review-request/${encodeURIComponent(decryptData(request.tokenEncrypted))}`,
  unsubscribeUrl: `${config.SHOPIFY_APP_URL}/unsubscribe/${encodeURIComponent(decryptData(request.tokenEncrypted))}`,
  secrets: [smtp.password, smtp.username],
  force: true,
});
console.log(`order=${order.orderNumber} from=${smtp.fromName} recipient=${maskEmail(decryptData(order.customer.emailEncrypted))} products=${products.map((product) => `${product.title}:${product.imageUrl ? 'image' : 'no-image'}`).join(' | ')} status=${result.status}`);
await db.$disconnect();
