import {z} from 'zod';
import {isSameOrigin} from '../../lib/csrf.server';
import {histogramCounts, type StarBucket} from './histogram';
import {publicReviewSubmissionSchema} from './review.schema';

const NUMERIC_PRODUCT_ID = /^\d{1,20}$/;
const PRODUCT_GID = /^gid:\/\/shopify\/Product\/(\d{1,20})$/;

export const ADMIN_REVIEW_SOURCE = 'ADMIN';
export const ADMIN_REVIEW_EVENT = 'ADMIN_CREATED';

export const adminReviewSchema = publicReviewSubmissionSchema.extend({
  status: z.enum(['APPROVED', 'PENDING']).default('APPROVED'),
  featured: z.boolean().default(false),
});

export type AdminReviewInput = z.infer<typeof adminReviewSchema>;

const FIELD_MESSAGES: Record<string, string> = {
  rating: 'Choose a rating from 1 to 5 stars.',
  body: 'Enter the review text (10 to 5000 characters).',
  displayName: 'Enter the name to show on the storefront (up to 60 characters).',
  title: 'The title must be 100 characters or fewer.',
  status: 'Choose Approved or Pending.',
};

export function canonicalProductId(value: unknown) {
  const token = String(value ?? '').trim();
  const gid = PRODUCT_GID.exec(token);
  const id = gid?.[1] ?? token;
  return NUMERIC_PRODUCT_ID.test(id) ? id : null;
}

export function productSearchQuery(term: unknown) {
  const cleaned = String(term ?? '').trim().replace(/[^\p{L}\p{N}\s._-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (cleaned.length < 2) return null;
  const token = cleaned.replace(/"/g, '');
  return `title:*${token}* OR handle:*${token}* OR sku:*${token}*`;
}

export function formatProductPrice(amount: string | null | undefined, currency: string | null | undefined) {
  if (!amount) return null;
  const value = Number(amount);
  if (!Number.isFinite(value)) return null;
  if (currency === 'USD') return `$${value.toFixed(2)}`;
  return currency ? `${value.toFixed(2)} ${currency}` : value.toFixed(2);
}

export type AdminProductChoice = {
  id: string;
  title: string;
  handle: string;
  status: string;
  imageUrl: string | null;
  price: string | null;
  sku: string | null;
};

export function parseAdminProduct(node: {
  id?: string | null;
  title?: string | null;
  handle?: string | null;
  status?: string | null;
  featuredImage?: {url?: string | null} | null;
  priceRange?: {minVariantPrice?: {amount?: string | null; currencyCode?: string | null} | null} | null;
  variants?: {nodes?: Array<{sku?: string | null} | null> | null} | null;
} | null | undefined): AdminProductChoice | null {
  if (!node) return null;
  const id = canonicalProductId(node.id);
  const title = node.title?.trim();
  if (!id || !title) return null;
  const imageUrl = node.featuredImage?.url?.startsWith('https://') ? node.featuredImage.url : null;
  const sku = node.variants?.nodes?.find((variant) => variant?.sku?.trim())?.sku?.trim() ?? null;
  return {
    id,
    title,
    handle: node.handle?.trim() || '',
    status: node.status?.trim() || 'UNKNOWN',
    imageUrl,
    price: formatProductPrice(node.priceRange?.minVariantPrice?.amount, node.priceRange?.minVariantPrice?.currencyCode),
    sku,
  };
}

export function parseAdminReviewForm(input: {
  rating?: unknown;
  title?: unknown;
  body?: unknown;
  displayName?: unknown;
  status?: unknown;
  featured?: unknown;
}) {
  const status = input.status === 'PENDING' || input.status === 'APPROVED' ? input.status : input.status;
  const parsed = adminReviewSchema.safeParse({
    rating: input.rating,
    title: typeof input.title === 'string' ? input.title.replace(/[\r\n]+/g, ' ') : '',
    body: typeof input.body === 'string' ? input.body : '',
    displayName: typeof input.displayName === 'string' ? input.displayName.replace(/[\r\n]+/g, ' ') : '',
    status,
    featured: input.featured === true || input.featured === 'true' || input.featured === 'on',
  });
  if (parsed.success) return {ok: true as const, data: parsed.data};
  const fieldErrors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = String(issue.path[0] ?? 'form');
    if (!fieldErrors[key]) fieldErrors[key] = FIELD_MESSAGES[key] ?? 'Check this field and try again.';
  }
  return {ok: false as const, fieldErrors};
}

export function adminReviewCreateData(input: {
  shopId: string;
  productId: string;
  data: AdminReviewInput;
  now?: Date;
}) {
  const submittedAt = input.now ?? new Date();
  return {
    shopId: input.shopId,
    productId: input.productId,
    rating: input.data.rating,
    title: input.data.title?.trim() ? input.data.title.trim() : null,
    body: input.data.body,
    displayName: input.data.displayName,
    status: input.data.status,
    featured: input.data.featured,
    verifiedPurchase: false,
    verificationReason: 'Created by the merchant. Not a verified purchase.',
    submittedAt,
  };
}

export function productOwnedByShop(productShopId: string, sessionShopId: string) {
  return productShopId === sessionShopId && productShopId.length > 0;
}

export function adminReviewRequestAllowed(request: Request) {
  return isSameOrigin(request);
}

export function shouldInvalidateRating(status: 'APPROVED' | 'PENDING') {
  return status === 'APPROVED';
}

export function distributionAfterReview(
  distribution: Partial<Record<StarBucket, number>> | null | undefined,
  rating: number,
  status: 'APPROVED' | 'PENDING',
) {
  const counts = histogramCounts(distribution);
  if (status === 'APPROVED' && rating >= 1 && rating <= 5) counts[String(rating) as StarBucket] += 1;
  return counts;
}
