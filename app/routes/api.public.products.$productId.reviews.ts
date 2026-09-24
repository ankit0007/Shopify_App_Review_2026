import {db} from '../db.server';
import {ok} from '../lib/api.server';
import {decodePublicCursor, encodePublicCursor, verifyAppProxySignature} from '../lib/shopify-signatures.server';
import {config} from '../config.server';
import {consumeRateLimit, requestClientKey} from '../lib/rate-limit.server';

export async function loader({params, request}: {params: {productId?: string}; request: Request}) {
  const rate = consumeRateLimit(`public-reviews:${requestClientKey(request)}`, 60, 60_000);
  if (!rate.allowed) {
    return Response.json({success: false, error: {code: 'RATE_LIMITED', message: 'Too many requests'}}, {
      status: 429,
      headers: {'Retry-After': String(rate.retryAfterSeconds)},
    });
  }
  const productId = params.productId;
  if (!productId) return Response.json({success: false, error: {code: 'MISSING_PRODUCT', message: 'Product is required'}}, {status: 400});
  const url = new URL(request.url);
  const shopDomain = url.searchParams.get('shop');
  if (!shopDomain) return Response.json({success: false, error: {code: 'MISSING_SHOP', message: 'Shop context is required'}}, {status: 400});
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shopDomain)) {
    return Response.json({success: false, error: {code: 'INVALID_SHOP', message: 'Shop context is invalid'}}, {status: 400});
  }
  if (!verifyAppProxySignature(url, config.SHOPIFY_API_SECRET)) {
    return Response.json({success: false, error: {code: 'INVALID_SIGNATURE', message: 'Request signature is invalid'}}, {status: 401});
  }
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 10), 1), 50);
  const cursorValue = url.searchParams.get('cursor');
  const cursor = cursorValue ? decodePublicCursor(cursorValue) : undefined;
  if (cursorValue && !cursor) return Response.json({success: false, error: {code: 'INVALID_CURSOR', message: 'Cursor is invalid'}}, {status: 400});

  const product = await db.product.findFirst({
    where: {shopifyProductId: productId, shop: {shopDomain}},
    select: {id: true},
  });
  if (!product) return ok({reviews: [], nextCursor: null});

  const reviews = await db.review.findMany({
    where: {productId: product.id, status: 'APPROVED'},
    orderBy: {submittedAt: 'desc'},
    take: limit + 1,
    ...(cursor ? {skip: 1, cursor: {id: cursor}} : {}),
    select: {
      id: true,
      rating: true,
      title: true,
      body: true,
      displayName: true,
      verifiedPurchase: true,
      submittedAt: true,
      media: {where: {approved: true}, select: {type: true}},
    },
  });
  const hasMore = reviews.length > limit;
  const items = hasMore ? reviews.slice(0, limit) : reviews;
  return ok({
    reviews: items.map(({id: _id, ...review}) => ({
      ...review,
      submittedAt: review.submittedAt.toISOString(),
    })),
    nextCursor: hasMore && items.at(-1) ? encodePublicCursor(items.at(-1)!.id) : null,
  });
}
