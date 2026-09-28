import {db} from '../db.server';
import {fail, ok} from '../lib/api.server';
import {decodePublicCursor, encodePublicCursor, verifyAppProxySignature} from '../lib/shopify-signatures.server';
import {config} from '../config.server';
import {consumeRateLimit, requestClientKey} from '../lib/rate-limit.server';
import {reviewSubmissionSchema} from '../modules/reviews/review.schema';
import {PlanService} from '../modules/plans/plan.service.server';

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
  const requestedLimit = Number(url.searchParams.get('limit') ?? 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.floor(requestedLimit), 1), 20) : 10;
  const cursorValue = url.searchParams.get('cursor');
  const cursor = cursorValue ? decodePublicCursor(cursorValue, config.SHOPIFY_API_SECRET) : undefined;
  if (cursorValue && !cursor) return Response.json({success: false, error: {code: 'INVALID_CURSOR', message: 'Cursor is invalid'}}, {status: 400});

  const product = await db.product.findFirst({
    where: {shopifyProductId: productId, shop: {shopDomain}},
    select: {id: true},
  });
  if (!product) return ok({reviews: [], nextCursor: null});

  const [reviews, aggregate] = await Promise.all([
    db.review.findMany({
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
    }),
    db.review.aggregate({
      where: {productId: product.id, status: 'APPROVED'},
      _avg: {rating: true},
      _count: {_all: true},
    }),
  ]);
  const hasMore = reviews.length > limit;
  const items = hasMore ? reviews.slice(0, limit) : reviews;
  return ok({
    reviews: items.map(({id: _id, ...review}) => ({
      ...review,
      submittedAt: review.submittedAt.toISOString(),
    })),
    nextCursor: hasMore && items.at(-1) ? encodePublicCursor(items.at(-1)!.id, config.SHOPIFY_API_SECRET) : null,
    averageRating: aggregate._avg.rating ?? 0,
    totalReviews: aggregate._count._all,
  });
}

export async function action({params, request}: {params: {productId?: string}; request: Request}) {
  const rate = consumeRateLimit(`public-review-submit:${requestClientKey(request)}`, 10, 60_000);
  if (!rate.allowed) {
    return Response.json({success: false, error: {code: 'RATE_LIMITED', message: 'Too many requests'}}, {
      status: 429,
      headers: {'Retry-After': String(rate.retryAfterSeconds)},
    });
  }
  const url = new URL(request.url);
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 64_000) {
    return fail('PAYLOAD_TOO_LARGE', 'Review submission is too large', 413);
  }
  if (!verifyAppProxySignature(url, config.SHOPIFY_API_SECRET)) {
    return fail('INVALID_SIGNATURE', 'Request signature is invalid', 401);
  }
  const shopDomain = url.searchParams.get('shop') ?? '';
  const productId = params.productId;
  if (!productId || !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shopDomain)) {
    return fail('INVALID_REQUEST', 'Shop and product are required');
  }
  const form = await request.formData();
  const parsed = reviewSubmissionSchema.safeParse({
    rating: form.get('rating'),
    title: form.get('title') || undefined,
    body: form.get('body'),
    displayName: form.get('displayName') || undefined,
  });
  if (!parsed.success) return fail('INVALID_REVIEW', 'Enter a rating and a review');

  const shop = await db.shop.findUnique({where: {shopDomain}, select: {id: true}});
  if (!shop) return fail('SHOP_NOT_INSTALLED', 'This shop has not installed the app', 404);
  const plan = new PlanService();
  const reviewLimit = await plan.checkLimit(shop.id, 'reviews');
  if (!reviewLimit.allowed) return fail('PLAN_LIMIT_REACHED', 'This shop has reached its review limit', 402);
  const product = await db.product.findUnique({
    where: {shopId_shopifyProductId: {shopId: shop.id, shopifyProductId: productId}},
    select: {id: true},
  });
  if (!product) return fail('PRODUCT_NOT_SYNCED', 'This product is not available yet', 404);
  const duplicate = await db.review.findFirst({
    where: {
      shopId: shop.id,
      productId: product.id,
      body: parsed.data.body,
      displayName: parsed.data.displayName ?? null,
      deletedAt: null,
      submittedAt: {gte: new Date(Date.now() - 24 * 60 * 60 * 1000)},
    },
    select: {id: true},
  });
  if (duplicate) return fail('DUPLICATE_REVIEW', 'This review was already submitted', 409);
  await db.review.create({
    data: {
      shopId: shop.id,
      productId: product.id,
      rating: parsed.data.rating,
      title: parsed.data.title,
      body: parsed.data.body,
      displayName: parsed.data.displayName,
      status: 'PENDING',
    },
  });
  await plan.increment(shop.id, 'reviews');
  return ok({status: 'PENDING'});
}
