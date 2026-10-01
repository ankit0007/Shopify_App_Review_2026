import {db} from '../app/db.server';
import {config} from '../app/config.server';
import {decryptData, encryptData} from '../app/lib/encrypted-data.server';
import {createReviewToken} from '../app/lib/tokens.server';
import {maskEmail} from '../app/modules/email/delivery.server';
import {processDueReviewRequests} from '../app/worker';

const RECIPIENT = process.argv[2] || '';
if (!RECIPIENT) {
  console.log('usage=send-shown-order.ts <test-recipient>');
  process.exit(1);
}
const ORDER_NUMBER = '1003';
const ORDER_KEY = 'name:1003';
const CUSTOMER_NAME = 'Ayumu Hirano';

const WANTED = [
  {title: 'The 3p Fulfilled Snowboard', fulfilled: false},
  {title: 'Selling Plans Ski Wax', fulfilled: true},
  {title: 'The Collection Snowboard: Oxygen', fulfilled: true},
] as const;

type ProductNode = {
  id: string;
  title: string;
  featuredImage?: {url?: string | null} | null;
  variants?: {nodes?: Array<{title?: string | null; price?: string | null}>};
};

const session = await db.session.findFirst({
  where: {isOnline: false, accessToken: {not: ''}},
  select: {shop: true, accessToken: true},
});
const shop = session ? await db.shop.findUnique({where: {shopDomain: session.shop}, select: {id: true, settings: {select: {requestExpirationDays: true}}}}) : null;
if (!session || !shop) {
  console.log('session=missing');
  process.exit(1);
}

console.log(`shop=${session.shop}`);
const response = await fetch(`https://${session.shop}/admin/api/${config.SHOPIFY_API_VERSION}/graphql.json`, {
  method: 'POST',
  headers: {'Content-Type': 'application/json', 'X-Shopify-Access-Token': session.accessToken},
  body: JSON.stringify({
    query: `query OrderProducts {
      products(first: 50) {
        nodes { id title featuredImage { url } variants(first: 30) { nodes { title price } } }
      }
    }`,
  }),
});
const payload = await response.json() as {errors?: Array<{message?: string}>; data?: {products?: {nodes?: ProductNode[]}}};
if (!response.ok || payload.errors?.length || !payload.data?.products) {
  const detail = (payload.errors ?? []).map((error) => error.message ?? '').join(' ').replace(/shpat_[A-Za-z0-9]+/g, '[redacted]').slice(0, 300);
  console.log(`products=denied detail=${detail || response.status}`);
  process.exit(1);
}

const catalog = payload.data.products.nodes ?? [];
const lines = WANTED.flatMap((wanted) => {
  const product = catalog.find((item) => item.title === wanted.title);
  if (!product) return [];
  const shopifyProductId = product.id.split('/').at(-1) ?? '';
  if (!/^\d{1,20}$/.test(shopifyProductId)) return [];
  const variants = (product.variants?.nodes ?? [])
    .map((variant) => variant.title ?? '')
    .filter((title) => title && title !== 'Default Title');
  const imageUrl = product.featuredImage?.url?.startsWith('https://') ? product.featuredImage.url : null;
  const quantity = wanted.title === 'Selling Plans Ski Wax' ? 3 : 1;
  return [{
    shopifyProductId,
    title: product.title,
    imageUrl,
    quantity,
    fulfilledQuantity: wanted.fulfilled ? quantity : 0,
    variantTitle: wanted.title === 'Selling Plans Ski Wax' ? variants.filter((title) => /special|sample|selling plans ski wax/i.test(title)).join(', ') || null : null,
  }];
});

console.log(`catalog=${catalog.length} titles=${catalog.map((item) => item.title).join(' | ')}`);
console.log(`matched=${lines.map((line) => line.title).join(' | ')}`);
if (lines.length !== WANTED.length) {
  console.log(`missing=${WANTED.filter((wanted) => !lines.some((line) => line.title === wanted.title)).map((wanted) => wanted.title).join(' | ')}`);
  process.exit(1);
}

const expiresAt = new Date(Date.now() + (shop.settings?.requestExpirationDays ?? 30) * 86_400_000);
const encryptedRecipient = encryptData(RECIPIENT);
const saved = await db.$transaction(async (tx) => {
  const customer = await tx.customer.upsert({
    where: {shopId_shopifyCustomerId: {shopId: shop.id, shopifyCustomerId: 'test:name:1003'}},
    update: {displayName: CUSTOMER_NAME},
    create: {shopId: shop.id, shopifyCustomerId: 'test:name:1003', displayName: CUSTOMER_NAME},
  });
  const order = await tx.order.upsert({
    where: {shopId_shopifyOrderId: {shopId: shop.id, shopifyOrderId: ORDER_KEY}},
    update: {orderNumber: ORDER_NUMBER, customerId: customer.id, financialStatus: 'paid', status: 'partial', fulfillmentDate: new Date('2026-09-30T13:07:00.000Z')},
    create: {shopId: shop.id, shopifyOrderId: ORDER_KEY, orderNumber: ORDER_NUMBER, customerId: customer.id, financialStatus: 'paid', status: 'partial', fulfillmentDate: new Date('2026-09-30T13:07:00.000Z')},
  });
  const existing = await tx.reviewRequest.findMany({
    where: {shopId: shop.id, orderId: order.id, isTest: true},
    select: {id: true, status: true, sentAt: true},
  });
  if (existing.some((request) => ['SENT', 'OPENED', 'CLICKED', 'SUBMITTED', 'SENDING'].includes(request.status) || request.sentAt)) {
    return {duplicate: true as const, anchorId: existing[0]?.id ?? ''};
  }
  const productIds: string[] = [];
  for (const line of lines) {
    const product = await tx.product.upsert({
      where: {shopId_shopifyProductId: {shopId: shop.id, shopifyProductId: line.shopifyProductId}},
      update: {title: line.title, ...(line.imageUrl ? {imageUrl: line.imageUrl} : {})},
      create: {shopId: shop.id, shopifyProductId: line.shopifyProductId, title: line.title, imageUrl: line.imageUrl},
    });
    productIds.push(product.id);
    await tx.orderItem.upsert({
      where: {orderId_productId: {orderId: order.id, productId: product.id}},
      update: {quantity: line.quantity, fulfilledQuantity: line.fulfilledQuantity, variantTitle: line.variantTitle},
      create: {orderId: order.id, productId: product.id, quantity: line.quantity, fulfilledQuantity: line.fulfilledQuantity, variantTitle: line.variantTitle},
    });
  }
  let anchorId = existing[0]?.id ?? '';
  if (existing.length === 0) {
    for (const [index, productId] of productIds.entries()) {
      const token = createReviewToken();
      const request = await tx.reviewRequest.create({
        data: {
          shopId: shop.id,
          orderId: order.id,
          productId,
          customerId: customer.id,
          tokenHash: token.tokenHash,
          tokenEncrypted: encryptData(token.token),
          status: index === 0 ? 'SCHEDULED' : 'PENDING',
          scheduledAt: index === 0 ? new Date() : null,
          expiresAt,
          isTest: true,
          testRecipientEncrypted: encryptedRecipient,
        },
        select: {id: true},
      });
      if (index === 0) anchorId = request.id;
    }
  } else if (anchorId) {
    await tx.reviewRequest.update({
      where: {id: anchorId},
      data: {status: 'SCHEDULED', scheduledAt: new Date(), lastError: null, isTest: true, testRecipientEncrypted: encryptedRecipient},
    });
  }
  return {duplicate: false as const, anchorId};
});

if (saved.duplicate) {
  console.log('queued=false detail=already-sent');
  process.exit(1);
}
console.log(`queued=true order=#${ORDER_NUMBER} products=${lines.length} recipient=${maskEmail(RECIPIENT)} anchor=${saved.anchorId}`);
await processDueReviewRequests();
const delivery = await db.emailDelivery.findFirst({
  where: {reviewRequestId: saved.anchorId},
  orderBy: {createdAt: 'desc'},
  select: {status: true, failureReason: true},
});
console.log(`delivery=${delivery?.status ?? 'none'} failure=${delivery?.failureReason ?? ''}`);
if (delivery?.status === 'ACCEPTED') {
  const links = await db.reviewRequest.findMany({
    where: {shopId: shop.id, order: {shopifyOrderId: ORDER_KEY}, isTest: true},
    select: {tokenEncrypted: true, product: {select: {shopifyProductId: true, title: true}}},
  });
  for (const link of links) {
    const token = decryptData(link.tokenEncrypted);
    console.log(`product=${link.product?.title ?? 'product'} url=${config.SHOPIFY_APP_URL}/review-request/${encodeURIComponent(token)}#product-${link.product?.shopifyProductId ?? ''}`);
  }
}
await db.$disconnect();
process.exit(delivery?.status === 'ACCEPTED' ? 0 : 2);
