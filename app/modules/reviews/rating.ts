export const MAX_RATING_PRODUCTS = 50;
export const MAX_RATING_QUERY_LENGTH = 4000;

const NUMERIC_ID = /^\d{1,20}$/;
const PRODUCT_GID = /^gid:\/\/shopify\/Product\/(\d{1,20})$/;

export type RatingCount = {rating: number; count: number};

export type PublicRating = {
  averageRating: number | null;
  reviewCount: number;
};

export function roundAverage(weightedSum: number, reviewCount: number) {
  if (!Number.isInteger(weightedSum) || !Number.isInteger(reviewCount) || reviewCount <= 0 || weightedSum < 0) return null;
  return Math.round((weightedSum * 10) / reviewCount) / 10;
}

export function summarizeRatingCounts(counts: RatingCount[]): PublicRating {
  let weightedSum = 0;
  let reviewCount = 0;
  for (const entry of counts) {
    if (!Number.isInteger(entry.rating) || entry.rating < 1 || entry.rating > 5) continue;
    if (!Number.isInteger(entry.count) || entry.count <= 0) continue;
    weightedSum += entry.rating * entry.count;
    reviewCount += entry.count;
  }
  return {averageRating: roundAverage(weightedSum, reviewCount), reviewCount};
}

export function starFills(averageRating: number | null) {
  if (averageRating == null) return [0, 0, 0, 0, 0];
  const tenths = Math.round(averageRating * 10);
  return [1, 2, 3, 4, 5].map((star) => Math.min(10, Math.max(0, tenths - (star - 1) * 10)) / 10);
}

export function formatAverage(averageRating: number | null) {
  return averageRating == null ? null : averageRating.toFixed(1);
}

export function productGid(productId: string) {
  return `gid://shopify/Product/${productId}`;
}

export function parseProductIds(value: string | null) {
  if (!value?.trim()) return {ok: false as const, code: 'MISSING_PRODUCTS'};
  if (value.length > MAX_RATING_QUERY_LENGTH) return {ok: false as const, code: 'QUERY_TOO_LARGE'};
  const ids: string[] = [];
  for (const part of value.split(',')) {
    const token = part.trim();
    const gid = PRODUCT_GID.exec(token);
    const id = gid?.[1] ?? token;
    if (!NUMERIC_ID.test(id)) return {ok: false as const, code: 'MALFORMED_PRODUCT_ID'};
    if (!ids.includes(id)) ids.push(id);
  }
  if (ids.length > MAX_RATING_PRODUCTS) return {ok: false as const, code: 'TOO_MANY_PRODUCTS'};
  return {ok: true as const, ids};
}

export function includeInRating(review: {
  status: string;
  deletedAt: Date | string | null;
  shopId: string;
  productId: string;
}, shopId: string, productId: string) {
  return review.status === 'APPROVED' && review.deletedAt == null && review.shopId === shopId && review.productId === productId;
}

export function assemblePublicRatings(input: {
  requestedIds: string[];
  ownedProductIds: string[];
  countsByProductId: Record<string, RatingCount[]>;
}) {
  const owned = new Set(input.ownedProductIds);
  const ratings: Record<string, PublicRating> = {};
  for (const id of input.requestedIds) {
    ratings[productGid(id)] = owned.has(id)
      ? summarizeRatingCounts(input.countsByProductId[id] ?? [])
      : {averageRating: null, reviewCount: 0};
  }
  return ratings;
}

export function ratingAriaLabel(rating: PublicRating) {
  if (rating.reviewCount === 0 || rating.averageRating == null) return 'No reviews yet';
  const average = formatAverage(rating.averageRating);
  const noun = rating.reviewCount === 1 ? 'review' : 'reviews';
  return `Rated ${average} out of 5 stars, ${rating.reviewCount} ${noun}`;
}
