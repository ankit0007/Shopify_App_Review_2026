import {db} from '../../db.server';
import {PlanService} from '../plans/plan.service.server';
import {invalidateRatingCache} from './rating-cache.server';
import {summarizeRatingCounts} from './rating';
import {
  ADMIN_REVIEW_EVENT,
  ADMIN_REVIEW_SOURCE,
  adminReviewCreateData,
  canonicalProductId,
  parseAdminProduct,
  parseAdminReviewForm,
  productSearchQuery,
  shouldInvalidateRating,
  type AdminProductChoice,
  type AdminReviewInput,
} from './admin-review';

type AdminClient = {
  graphql: (query: string, options?: {variables?: Record<string, unknown>}) => Promise<Response>;
};

const PRODUCT_FIELDS = `
  id
  title
  handle
  status
  featuredImage { url }
  priceRange { minVariantPrice { amount currencyCode } }
  variants(first: 1) { nodes { sku } }
`;

export async function searchShopProducts(admin: AdminClient, term: string): Promise<AdminProductChoice[]> {
  const query = productSearchQuery(term);
  if (!query) return [];
  const response = await admin.graphql(`#graphql
    query AdminProductSearch($query: String!) {
      products(first: 8, query: $query) {
        nodes { ${PRODUCT_FIELDS} }
      }
    }`, {variables: {query}});
  const body = await response.json() as {data?: {products?: {nodes?: Array<Parameters<typeof parseAdminProduct>[0]>}}};
  return (body.data?.products?.nodes ?? []).flatMap((node) => {
    const product = parseAdminProduct(node);
    return product ? [product] : [];
  });
}

export async function verifyShopProduct(admin: AdminClient, productId: string): Promise<AdminProductChoice | null> {
  const id = canonicalProductId(productId);
  if (!id) return null;
  const response = await admin.graphql(`#graphql
    query AdminProduct($id: ID!) {
      product(id: $id) { ${PRODUCT_FIELDS} }
    }`, {variables: {id: `gid://shopify/Product/${id}`}});
  const body = await response.json() as {data?: {product?: Parameters<typeof parseAdminProduct>[0]}};
  const product = parseAdminProduct(body.data?.product);
  return product?.id === id ? product : null;
}

export async function createAdminReview(input: {
  shopId: string;
  shopDomain: string;
  product: AdminProductChoice;
  data: AdminReviewInput;
}) {
  const plan = new PlanService();
  const reviewLimit = await plan.checkLimit(input.shopId, 'reviews');
  if (!reviewLimit.allowed) return {ok: false as const, message: 'This plan has reached its review limit.', fieldErrors: {}};

  const handle = /^[a-z0-9][a-z0-9-]*$/i.test(input.product.handle) ? input.product.handle : null;
  const created = await db.$transaction(async (tx) => {
    const product = await tx.product.upsert({
      where: {shopId_shopifyProductId: {shopId: input.shopId, shopifyProductId: input.product.id}},
      update: {title: input.product.title, handle},
      create: {
        shopId: input.shopId,
        shopifyProductId: input.product.id,
        title: input.product.title,
        handle,
        imageUrl: input.product.imageUrl,
      },
    });
    const review = await tx.review.create({
      data: adminReviewCreateData({shopId: input.shopId, productId: product.id, data: input.data}),
    });
    await tx.reviewEvent.create({
      data: {
        shopId: input.shopId,
        reviewId: review.id,
        action: ADMIN_REVIEW_EVENT,
        metadata: {source: ADMIN_REVIEW_SOURCE},
      },
    });
    await tx.auditLog.create({
      data: {
        shopId: input.shopId,
        actorType: 'MERCHANT',
        action: 'ADMIN_CREATE',
        entity: 'REVIEW',
        entityId: review.id,
        metadata: {
          source: ADMIN_REVIEW_SOURCE,
          event: 'review_created',
          status: review.status,
          rating: review.rating,
          productId: product.shopifyProductId,
          verifiedPurchase: review.verifiedPurchase,
        },
      },
    });
    return {review, shopifyProductId: product.shopifyProductId};
  });

  await plan.increment(input.shopId, 'reviews');
  const publicStatus = created.review.status === 'APPROVED' ? 'APPROVED' : 'PENDING';
  if (shouldInvalidateRating(publicStatus)) invalidateRatingCache(input.shopDomain, created.shopifyProductId);

  const counts = await db.review.groupBy({
    by: ['rating'],
    where: {shopId: input.shopId, productId: created.review.productId, status: 'APPROVED', deletedAt: null},
    _count: {rating: true},
  });
  const summary = summarizeRatingCounts(counts.map((row) => ({rating: row.rating, count: row._count.rating})));
  return {
    ok: true as const,
    review: {
      productTitle: input.product.title,
      rating: created.review.rating,
      displayName: created.review.displayName ?? '',
      status: publicStatus,
      averageRating: summary.averageRating,
      reviewCount: summary.reviewCount,
    },
  };
}

export function readAdminReviewForm(form: FormData) {
  return parseAdminReviewForm({
    rating: form.get('rating'),
    title: form.get('title'),
    body: form.get('body'),
    displayName: form.get('displayName'),
    status: form.get('status'),
    featured: form.get('featured'),
    verifiedPurchase: form.get('verifiedPurchase'),
  });
}
