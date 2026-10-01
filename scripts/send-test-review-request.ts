import {db} from '../app/db.server';
import {config} from '../app/config.server';
import {decryptData} from '../app/lib/encrypted-data.server';
import {maskEmail} from '../app/modules/email/delivery.server';
import {DEFAULT_TEST_RECIPIENT} from '../app/modules/reviews/request-test';
import {createTestReviewRequest} from '../app/modules/reviews/request-test.server';

const orderNumber = process.argv[2] || '1003';
const testRecipient = process.argv[3] || DEFAULT_TEST_RECIPIENT;
const session = await db.session.findFirst({
  where: {isOnline: false, accessToken: {not: ''}},
  select: {shop: true, accessToken: true},
});
if (!session) {
  console.log('session=missing');
  process.exit(1);
}
const shop = await db.shop.findUnique({where: {shopDomain: session.shop}, select: {id: true}});
if (!shop) {
  console.log('shop=missing');
  process.exit(1);
}

const admin = {
  graphql: (query: string, options?: {variables?: Record<string, unknown>}) => fetch(`https://${session.shop}/admin/api/${config.SHOPIFY_API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'X-Shopify-Access-Token': session.accessToken},
    body: JSON.stringify({query, variables: options?.variables ?? {}}),
  }),
};

const result = await createTestReviewRequest({admin, shopId: shop.id, orderNumber, testRecipient});
if (!result.ok) {
  console.log(`queued=false detail=${result.error}`);
  process.exit(1);
}
console.log(`queued=true order=#${result.orderNumber} products=${result.productCount} recipient=${maskEmail(result.testRecipient)} anchor=${result.anchorId}`);

const deadline = Date.now() + 150_000;
let delivery: {status: string; failureReason: string | null} | null = null;
while (Date.now() < deadline) {
  delivery = await db.emailDelivery.findFirst({
    where: {reviewRequestId: result.anchorId},
    orderBy: {createdAt: 'desc'},
    select: {status: true, failureReason: true},
  });
  if (delivery && ['ACCEPTED', 'FAILED', 'EXPIRED'].includes(delivery.status)) break;
  await new Promise((resolve) => setTimeout(resolve, 3000));
}
console.log(`delivery=${delivery?.status ?? 'none'} failure=${delivery?.failureReason ?? ''}`);

if (delivery?.status === 'ACCEPTED') {
  const links = await db.reviewRequest.findMany({
    where: {shopId: shop.id, isTest: true, order: {orderNumber: result.orderNumber}},
    select: {tokenEncrypted: true, product: {select: {shopifyProductId: true, title: true}}},
  });
  for (const link of links) {
    const token = decryptData(link.tokenEncrypted);
    console.log(`product=${link.product?.title ?? 'product'} url=${config.SHOPIFY_APP_URL}/review-request/${encodeURIComponent(token)}#product-${link.product?.shopifyProductId ?? ''}`);
  }
}

await db.$disconnect();
process.exit(delivery?.status === 'ACCEPTED' ? 0 : 2);
