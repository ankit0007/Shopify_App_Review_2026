import {db} from '../db.server';
import {fail, ok} from '../lib/api.server';
import {decodeOpaqueCursor, encodeOpaqueCursor, verifyAppProxySignature} from '../lib/shopify-signatures.server';
import {config} from '../config.server';
import {consumeRateLimit, requestClientKey} from '../lib/rate-limit.server';
import {cursorMatchesQuery, cursorPayload, emptyDistribution, parseListQuery, readCursorPayload} from '../modules/reviews/public-list';
import {summarizeRatingCounts} from '../modules/reviews/rating';

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
  const shopSettings = await db.shop.findUnique({
    where: {shopDomain},
    select: {settings: {select: {showWriteReviewButton: true}}},
  });
  const showWriteReviewButton = shopSettings?.settings?.showWriteReviewButton === true;
  const requestedLimit = Number(url.searchParams.get('limit') ?? 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.floor(requestedLimit), 1), 20) : 10;
  const listQuery = parseListQuery(url.searchParams.get('sort'), url.searchParams.get('rating'));
  if (!listQuery.ok) return fail(listQuery.code, 'The review list filters are invalid');
  const cursorValue = url.searchParams.get('cursor');
  const cursorText = cursorValue ? decodeOpaqueCursor(cursorValue, config.SHOPIFY_API_SECRET) : null;
  const cursor = cursorText ? readCursorPayload(cursorText) : null;
  if (cursorValue && (!cursor || !cursorMatchesQuery(cursor, listQuery))) {
    return fail('INVALID_CURSOR', 'Cursor is invalid', 400);
  }

  const product = await db.product.findFirst({
    where: {shopifyProductId: productId, shop: {shopDomain}},
    select: {id: true},
  });
  const empty = {reviews: [], nextCursor: null, averageRating: null, totalReviews: 0, distribution: emptyDistribution(), showWriteReviewButton};
  if (!product) return ok(empty, {headers: {'Cache-Control': 'private, no-store'}});

  const orderBy = listQuery.sort === 'highest'
    ? [{rating: 'desc' as const}, {submittedAt: 'desc' as const}, {id: 'desc' as const}]
    : listQuery.sort === 'lowest'
      ? [{rating: 'asc' as const}, {submittedAt: 'desc' as const}, {id: 'desc' as const}]
      : [{submittedAt: 'desc' as const}, {id: 'desc' as const}];
  const [reviews, groups] = await Promise.all([
    db.review.findMany({
    where: {productId: product.id, status: 'APPROVED', deletedAt: null, ...(listQuery.rating ? {rating: listQuery.rating} : {})},
    orderBy,
    take: limit + 1,
    ...(cursor ? {skip: 1, cursor: {id: cursor.id}} : {}),
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
    }),
    db.review.groupBy({
      by: ['rating'],
      where: {productId: product.id, status: 'APPROVED', deletedAt: null},
      _count: {_all: true},
    }),
  ]);
  const hasMore = reviews.length > limit;
  const items = hasMore ? reviews.slice(0, limit) : reviews;
  const distribution = emptyDistribution();
  for (const group of groups) distribution[String(group.rating) as '1'] = group._count._all;
  const summary = summarizeRatingCounts([1, 2, 3, 4, 5].map((rating) => ({rating, count: distribution[String(rating) as '1']})));
  const last = items.at(-1);
  return ok({
    reviews: items.map(({id: _id, ...review}) => ({
      ...review,
      submittedAt: review.submittedAt.toISOString(),
    })),
    nextCursor: hasMore && last ? encodeOpaqueCursor(cursorPayload(listQuery.sort, listQuery.rating, last.id), config.SHOPIFY_API_SECRET) : null,
    averageRating: summary.averageRating,
    totalReviews: summary.reviewCount,
    distribution,
    showWriteReviewButton,
  }, {headers: {'Cache-Control': 'private, no-store'}});
}

export async function action(_args: {params: {productId?: string}; request: Request}) {
  return fail(
    'REVIEW_REQUEST_REQUIRED',
    'Reviews can only be submitted through a valid review-request link.',
    403,
  );
}
