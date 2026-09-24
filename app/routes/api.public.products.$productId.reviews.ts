import {db} from '../db.server';
import {ok} from '../lib/api.server';

export async function loader({params, request}: {params: {productId?: string}; request: Request}) {
  const productId = params.productId;
  if (!productId) return Response.json({success: false, error: {code: 'MISSING_PRODUCT', message: 'Product is required'}}, {status: 400});
  const url = new URL(request.url);
  const shopDomain = url.searchParams.get('shop') ?? request.headers.get('x-shopify-shop-domain');
  if (!shopDomain) return Response.json({success: false, error: {code: 'MISSING_SHOP', message: 'Shop context is required'}}, {status: 400});
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 10), 1), 50);
  const cursor = url.searchParams.get('cursor') ?? undefined;

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
      media: {where: {approved: true}, select: {type: true, storageKey: true, thumbnailKey: true}},
    },
  });
  const hasMore = reviews.length > limit;
  const items = hasMore ? reviews.slice(0, limit) : reviews;
  return ok({
    reviews: items.map((review) => ({
      ...review,
      submittedAt: review.submittedAt.toISOString(),
    })),
    nextCursor: hasMore ? items.at(-1)?.id ?? null : null,
  });
}
