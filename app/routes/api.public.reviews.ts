import {db} from '../db.server';
import {fail, ok} from '../lib/api.server';
import {decodeOpaqueCursor, encodeOpaqueCursor, verifyAppProxySignature} from '../lib/shopify-signatures.server';
import {config} from '../config.server';
import {consumeRateLimit, requestClientKey} from '../lib/rate-limit.server';
import {cursorMatchesQuery, cursorPayload, emptyDistribution, parseListQuery, readCursorPayload} from '../modules/reviews/public-list';
import {summarizeRatingCounts} from '../modules/reviews/rating';
import {globalApprovedWhere, handlesByProductId, pageSlice, publicProductLink, publicShopDomain} from '../modules/reviews/global-reviews';
import {unauthenticated} from '../shopify.server';

const PAGE = `<div id="shopify-all-reviews" class="shopify-reviews" data-shop="{{ shop.permanent_domain | escape }}">
  <h1 class="sr__title">Customer Reviews</h1>
  <div data-summary aria-busy="true"><p>Loading reviews…</p></div>
  <div class="sr__toolbar" data-toolbar hidden></div>
  <ol class="sr__list" data-list></ol>
  <button type="button" class="sr-btn sr-btn--ghost" data-more hidden>Load more</button>
  <p data-error hidden>Reviews could not be loaded. Please try again.</p>
</div>
<link rel="stylesheet" href="/apps/shopify-review/storefront/review-widgets.css">
<script src="/apps/shopify-review/storefront/all-reviews.js" defer></script>`;

function emptyPayload() {
  return {reviews: [], nextCursor: null, averageRating: null, totalReviews: 0, distribution: emptyDistribution()};
}

async function rememberedHandles(shopDomain: string, products: Array<{id: string; shopifyProductId: string; handle: string | null}>) {
  const known = new Map(products.filter((product) => product.handle).map((product) => [product.shopifyProductId, product.handle as string]));
  const missing = products.filter((product) => !product.handle);
  if (!missing.length) return known;
  try {
    const {admin} = await unauthenticated.admin(shopDomain);
    const response = await admin.graphql(`#graphql
      query ProductHandles($ids: [ID!]!) {
        nodes(ids: $ids) { ... on Product { id handle } }
      }`, {variables: {ids: missing.map((product) => `gid://shopify/Product/${product.shopifyProductId}`)}});
    const payload = await response.json() as {data?: {nodes?: Array<{id?: string | null; handle?: string | null} | null>}};
    const found = handlesByProductId(payload.data?.nodes);
    await Promise.all(missing.map((product) => {
      const handle = found.get(product.shopifyProductId);
      return handle ? db.product.update({where: {id: product.id}, data: {handle}}) : Promise.resolve();
    }));
    found.forEach((handle, id) => known.set(id, handle));
  } catch {
    return known;
  }
  return known;
}

export async function loader({request}: {request: Request}) {
  const rate = consumeRateLimit(`public-all-reviews:${requestClientKey(request)}`, 60, 60_000);
  if (!rate.allowed) {
    return Response.json({success: false, error: {code: 'RATE_LIMITED', message: 'Too many requests'}}, {
      status: 429,
      headers: {'Retry-After': String(rate.retryAfterSeconds)},
    });
  }
  const url = new URL(request.url);
  const shop = publicShopDomain(url.searchParams.get('shop'));
  if (!shop.ok) return fail(shop.code, shop.code === 'MISSING_SHOP' ? 'Shop context is required' : 'Shop context is invalid');
  if (!verifyAppProxySignature(url, config.SHOPIFY_API_SECRET)) return fail('INVALID_SIGNATURE', 'Request signature is invalid', 401);
  if (url.searchParams.get('format') !== 'json') {
    return new Response(PAGE, {headers: {'Content-Type': 'application/liquid', 'Cache-Control': 'public, max-age=60'}});
  }

  const requestedLimit = Number(url.searchParams.get('limit') ?? 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.floor(requestedLimit), 1), 20) : 10;
  const listQuery = parseListQuery(url.searchParams.get('sort'), url.searchParams.get('rating'));
  if (!listQuery.ok) return fail(listQuery.code, 'The review list filters are invalid');
  const cursorValue = url.searchParams.get('cursor');
  const cursorText = cursorValue ? decodeOpaqueCursor(cursorValue, config.SHOPIFY_API_SECRET) : null;
  const cursor = cursorText ? readCursorPayload(cursorText) : null;
  if (cursorValue && (!cursor || !cursorMatchesQuery(cursor, listQuery))) return fail('INVALID_CURSOR', 'Cursor is invalid', 400);

  try {
    const shopRow = await db.shop.findUnique({
      where: {shopDomain: shop.shop},
      select: {
        id: true,
        settings: {
          select: {
            showAllReviewsTab: true,
            reviewsButtonEnabled: true,
          },
        },
      },
    });
    const settings = shopRow?.settings;
    const showAllReviewsTab = settings?.reviewsButtonEnabled ?? settings?.showAllReviewsTab !== false;
    if (!shopRow) return ok({...emptyPayload(), showAllReviewsTab}, {headers: {'Cache-Control': 'private, no-store'}});
    const approved = globalApprovedWhere(shopRow.id);
    const orderBy = listQuery.sort === 'highest'
      ? [{rating: 'desc' as const}, {submittedAt: 'desc' as const}, {id: 'desc' as const}]
      : listQuery.sort === 'lowest'
        ? [{rating: 'asc' as const}, {submittedAt: 'desc' as const}, {id: 'desc' as const}]
        : [{submittedAt: 'desc' as const}, {id: 'desc' as const}];
    const [rows, groups] = await Promise.all([
      db.review.findMany({
        where: {...approved, ...(listQuery.rating ? {rating: listQuery.rating} : {})},
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
          product: {select: {id: true, title: true, handle: true, shopifyProductId: true, imageUrl: true}},
        },
      }),
      db.review.groupBy({by: ['rating'], where: approved, _count: {_all: true}}),
    ]);
    const page = pageSlice(rows, limit);
    const handles = await rememberedHandles(shop.shop, page.items.map((review) => review.product));
    const distribution = emptyDistribution();
    for (const group of groups) distribution[String(group.rating) as '1'] = group._count._all;
    const summary = summarizeRatingCounts([1, 2, 3, 4, 5].map((rating) => ({rating, count: distribution[String(rating) as '1']})));
    const last = page.items.at(-1);
    return ok({
      reviews: page.items.map(({id: _id, product, submittedAt, ...review}) => {
        const link = publicProductLink({title: product.title, handle: handles.get(product.shopifyProductId) ?? product.handle});
        const imageUrl = product.imageUrl?.startsWith('https://') ? product.imageUrl : null;
        return {
          ...review,
          submittedAt: submittedAt.toISOString(),
          product: link ? {...link, imageUrl} : null,
        };
      }),
      showAllReviewsTab,
      nextCursor: page.hasMore && last ? encodeOpaqueCursor(cursorPayload(listQuery.sort, listQuery.rating, last.id), config.SHOPIFY_API_SECRET) : null,
      averageRating: summary.averageRating,
      totalReviews: summary.reviewCount,
      distribution,
    }, {headers: {'Cache-Control': 'private, no-store'}});
  } catch {
    return fail('REVIEWS_UNAVAILABLE', 'Reviews could not be loaded', 500);
  }
}
