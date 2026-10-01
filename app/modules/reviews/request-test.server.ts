import {db} from '../../db.server';
import {encryptData} from '../../lib/encrypted-data.server';
import {createReviewToken} from '../../lib/tokens.server';
import {loadEnabledSmtp} from '../email/delivery.server';
import {
  DEFAULT_TEST_RECIPIENT,
  parseOrderNumber,
  parseTestRecipient,
  reviewEmailAlreadySent,
  safeShopifyMessage,
} from './request-test';

export const SMTP_NOT_CONFIGURED = 'SMTP is not configured. Configure SMTP before sending review-request emails.';

type AdminClient = {
  graphql: (query: string, options?: {variables?: Record<string, unknown>}) => Promise<Response>;
};

type ShopifyLine = {
  title?: string | null;
  quantity?: number | null;
  variantTitle?: string | null;
  product?: {id?: string | null; title?: string | null; featuredImage?: {url?: string | null} | null} | null;
};

type ShopifyOrder = {
  id: string;
  name: string;
  displayFulfillmentStatus?: string | null;
  displayFinancialStatus?: string | null;
  lineItems?: {nodes?: ShopifyLine[]} | null;
};

const ORDER_QUERY = `#graphql
  query TestReviewOrder($query: String!) {
    orders(first: 1, query: $query) {
      nodes {
        id
        name
        displayFulfillmentStatus
        displayFinancialStatus
        lineItems(first: 50) {
          nodes {
            title
            quantity
            variantTitle
            product { id title featuredImage { url } }
          }
        }
      }
    }
  }
`;

export async function createTestReviewRequest(input: {
  admin: AdminClient;
  shopId: string;
  orderNumber: string;
  testRecipient?: string | null;
}) {
  const orderNumber = parseOrderNumber(input.orderNumber);
  if (!orderNumber) return {ok: false as const, error: 'Enter a Shopify order number such as 1003.'};
  const testRecipient = parseTestRecipient(input.testRecipient || DEFAULT_TEST_RECIPIENT);
  if (!testRecipient) return {ok: false as const, error: 'Enter a valid TEST recipient.'};
  const smtp = await loadEnabledSmtp();
  if (!smtp) return {ok: false as const, error: SMTP_NOT_CONFIGURED};

  let payload: {data?: {orders?: {nodes?: ShopifyOrder[]}}; errors?: Array<{message?: string}>};
  try {
    const response = await input.admin.graphql(ORDER_QUERY, {variables: {query: `name:${orderNumber}`}});
    payload = await response.json();
  } catch (error) {
    return {ok: false as const, error: safeShopifyMessage(error instanceof Error ? error.message : 'Shopify could not load this order.')};
  }
  const remote = payload.data?.orders?.nodes?.[0];
  if (!remote) {
    const detail = payload.errors?.map((error) => error.message ?? '').filter(Boolean).join(' ');
    return {ok: false as const, error: safeShopifyMessage(detail || `Shopify order #${orderNumber} was not found.`)};
  }

  const lines = (remote.lineItems?.nodes ?? []).flatMap((line) => {
    const shopifyProductId = line.product?.id?.split('/').at(-1) ?? '';
    if (!/^\d{1,20}$/.test(shopifyProductId)) return [];
    const imageUrl = line.product?.featuredImage?.url?.startsWith('https://') ? line.product.featuredImage.url : null;
    return [{
      shopifyProductId,
      title: line.product?.title || line.title || 'Untitled product',
      variantTitle: line.variantTitle && line.variantTitle !== 'Default Title' ? line.variantTitle : null,
      quantity: Math.max(1, line.quantity ?? 1),
      imageUrl,
    }];
  });
  if (lines.length === 0) return {ok: false as const, error: `Shopify order #${orderNumber} has no reviewable products.`};

  const shopifyOrderId = remote.id.split('/').at(-1) ?? '';
  if (!/^\d{1,20}$/.test(shopifyOrderId)) return {ok: false as const, error: 'Shopify returned an order id this app cannot store.'};
  const shop = await db.shop.findUnique({where: {id: input.shopId}, select: {settings: {select: {requestExpirationDays: true}}}});
  const expiresAt = new Date(Date.now() + (shop?.settings?.requestExpirationDays ?? 30) * 86_400_000);
  const fulfilled = /FULFILLED/i.test(remote.displayFulfillmentStatus ?? '');
  const financialStatus = (remote.displayFinancialStatus ?? '').toLowerCase() || null;
  const testCustomerKey = `test:${shopifyOrderId}`;
  const encryptedRecipient = encryptData(testRecipient);

  const saved = await db.$transaction(async (tx) => {
    const customer = await tx.customer.upsert({
      where: {shopId_shopifyCustomerId: {shopId: input.shopId, shopifyCustomerId: testCustomerKey}},
      update: {},
      create: {shopId: input.shopId, shopifyCustomerId: testCustomerKey, displayName: 'Customer'},
    });
    const currentOrder = await tx.order.findUnique({
      where: {shopId_shopifyOrderId: {shopId: input.shopId, shopifyOrderId}},
      select: {customerId: true, fulfillmentDate: true},
    });
    const order = await tx.order.upsert({
      where: {shopId_shopifyOrderId: {shopId: input.shopId, shopifyOrderId}},
      update: {
        orderNumber,
        financialStatus,
        ...(!currentOrder?.customerId ? {customerId: customer.id} : {}),
        ...(fulfilled && !currentOrder?.fulfillmentDate ? {fulfillmentDate: new Date(), status: 'fulfilled'} : {}),
      },
      create: {shopId: input.shopId, shopifyOrderId, orderNumber, customerId: customer.id, financialStatus, status: fulfilled ? 'fulfilled' : 'open', ...(fulfilled ? {fulfillmentDate: new Date()} : {})},
    });
    const existing = await tx.reviewRequest.findMany({
      where: {shopId: input.shopId, orderId: order.id, isTest: true},
      select: {id: true, status: true, sentAt: true, productId: true},
    });
    if (existing.some((request) => reviewEmailAlreadySent(request.status, request.sentAt))) {
      return {duplicate: true as const, orderNumber, productCount: lines.length, anchorId: existing[0]?.id ?? ''};
    }
    const productIds: string[] = [];
    for (const line of lines) {
      const product = await tx.product.upsert({
        where: {shopId_shopifyProductId: {shopId: input.shopId, shopifyProductId: line.shopifyProductId}},
        update: {title: line.title, ...(line.imageUrl ? {imageUrl: line.imageUrl} : {})},
        create: {shopId: input.shopId, shopifyProductId: line.shopifyProductId, title: line.title, imageUrl: line.imageUrl},
      });
      productIds.push(product.id);
      await tx.orderItem.upsert({
        where: {orderId_productId: {orderId: order.id, productId: product.id}},
        update: {quantity: line.quantity, variantTitle: line.variantTitle, ...(fulfilled ? {fulfilledQuantity: line.quantity} : {})},
        create: {orderId: order.id, productId: product.id, quantity: line.quantity, variantTitle: line.variantTitle, fulfilledQuantity: fulfilled ? line.quantity : 0},
      });
    }
    if (existing.length > 0) {
      const anchor = existing.find((request) => request.status === 'SCHEDULED' || request.status === 'FAILED' || request.status === 'BLOCKED' || request.status === 'PENDING') ?? existing[0];
      await tx.reviewRequest.updateMany({
        where: {id: {in: existing.map((request) => request.id).filter((id) => id !== anchor?.id)}, status: {in: ['SCHEDULED', 'FAILED', 'BLOCKED']}},
        data: {status: 'PENDING', scheduledAt: null, lastError: null, testRecipientEncrypted: encryptedRecipient},
      });
      for (const productId of productIds) {
        if (existing.some((request) => request.productId === productId)) continue;
        const token = createReviewToken();
        await tx.reviewRequest.create({
          data: {
            shopId: input.shopId,
            orderId: order.id,
            productId,
            customerId: customer.id,
            tokenHash: token.tokenHash,
            tokenEncrypted: encryptData(token.token),
            status: 'PENDING',
            expiresAt,
            isTest: true,
            testRecipientEncrypted: encryptedRecipient,
          },
        });
      }
      if (anchor) {
        await tx.reviewRequest.update({
          where: {id: anchor.id},
          data: {status: 'SCHEDULED', scheduledAt: new Date(), lastError: null, isTest: true, testRecipientEncrypted: encryptedRecipient},
        });
      }
      return {duplicate: false as const, orderNumber, productCount: lines.length, anchorId: anchor?.id ?? ''};
    }
    let anchorId = '';
    for (const [index, productId] of productIds.entries()) {
      const token = createReviewToken();
      const request = await tx.reviewRequest.create({
        data: {
          shopId: input.shopId,
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
    return {duplicate: false as const, orderNumber, productCount: productIds.length, anchorId};
  });

  if (saved.duplicate) return {ok: false as const, error: `A test review email for order #${orderNumber} was already sent.`};
  return {ok: true as const, orderNumber: saved.orderNumber, productCount: saved.productCount, anchorId: saved.anchorId, testRecipient};
}

export async function queueReviewRequest(input: {shopId: string; requestId: string; intent: 'send' | 'retry'}) {
  const request = await db.reviewRequest.findFirst({
    where: {id: input.requestId, shopId: input.shopId},
    select: {id: true, status: true, sentAt: true, isTest: true, testRecipientEncrypted: true},
  });
  if (!request) return {ok: false as const, error: 'Request was not found.'};
  if (reviewEmailAlreadySent(request.status, request.sentAt)) return {ok: false as const, error: 'This request was already sent.'};
  if (input.intent === 'send' && !request.isTest) return {ok: false as const, error: 'Send is available for TEST requests. Automatic requests are sent by the worker.'};
  if (input.intent === 'retry' && request.status !== 'FAILED' && request.status !== 'BLOCKED') {
    return {ok: false as const, error: 'Only failed or blocked requests can be retried.'};
  }
  if (!request.isTest && request.status === 'BLOCKED') {
    return {ok: false as const, error: 'Protected customer data access required'};
  }
  const smtp = await loadEnabledSmtp();
  if (!smtp) return {ok: false as const, error: SMTP_NOT_CONFIGURED};
  await db.reviewRequest.update({
    where: {id: request.id},
    data: {status: 'SCHEDULED', scheduledAt: new Date(), lastError: null},
  });
  return {ok: true as const};
}
