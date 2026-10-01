import {roundAverage} from '../reviews/rating';

export type RatingDistribution = Record<1 | 2 | 3 | 4 | 5, number>;

export function emptyDistribution(): RatingDistribution {
  return {1: 0, 2: 0, 3: 0, 4: 0, 5: 0};
}

export function sharePercent(part: number, whole: number) {
  if (!Number.isInteger(part) || !Number.isInteger(whole) || whole <= 0 || part < 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}

export function formatShare(part: number, whole: number) {
  const value = sharePercent(part, whole);
  if (value == null) return null;
  return Number.isInteger(value) ? `${value}%` : `${value.toFixed(1)}%`;
}

export function distributionWidth(count: number, approved: number) {
  if (approved <= 0 || count <= 0) return 0;
  return (count / approved) * 100;
}

export function summarizeRequests(counts: Record<string, number>) {
  const value = (status: string) => counts[status] ?? 0;
  const sent = value('SENT') + value('OPENED') + value('CLICKED') + value('SUBMITTED');
  const pending = value('PENDING') + value('SCHEDULED') + value('SENDING');
  const failed = value('FAILED');
  const submitted = value('SUBMITTED');
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  return {
    sent,
    pending,
    failed,
    submitted,
    conversion: sent > 0 ? submitted / sent : null,
    hasData: total > 0,
  };
}

export function reviewActivity(days: Array<{day: string; count: number}>) {
  const points = days.filter((day) => day.count > 0);
  return points.length >= 2 ? points : null;
}

export type ProductReviewBucket = {
  productId: string;
  status: string;
  rating: number;
  verifiedPurchase: boolean;
  count: number;
};

export type ProductPerformance = {
  productId: string;
  total: number;
  approved: number;
  pending: number;
  verified: number;
  averageRating: number | null;
};

export function productPerformance(rows: ProductReviewBucket[], limit = 5): ProductPerformance[] {
  const byProduct = new Map<string, ProductPerformance & {weighted: number}>();
  for (const row of rows) {
    if (!Number.isInteger(row.count) || row.count <= 0) continue;
    const current = byProduct.get(row.productId) ?? {
      productId: row.productId,
      total: 0,
      approved: 0,
      pending: 0,
      verified: 0,
      averageRating: null,
      weighted: 0,
    };
    current.total += row.count;
    if (row.status === 'APPROVED') {
      current.approved += row.count;
      if (row.rating >= 1 && row.rating <= 5) current.weighted += row.rating * row.count;
      if (row.verifiedPurchase) current.verified += row.count;
    }
    if (row.status === 'PENDING') current.pending += row.count;
    byProduct.set(row.productId, current);
  }
  return [...byProduct.values()]
    .map((product) => ({
      productId: product.productId,
      total: product.total,
      approved: product.approved,
      pending: product.pending,
      verified: product.verified,
      averageRating: roundAverage(product.weighted, product.approved),
    }))
    .sort((left, right) => right.total - left.total || left.productId.localeCompare(right.productId))
    .slice(0, limit);
}

export function reviewerInitials(name: string | null | undefined) {
  const parts = (name?.trim() || 'Customer').split(/\s+/).slice(0, 2);
  const initials = parts.map((part) => part[0]?.toUpperCase() ?? '').join('');
  return initials || 'C';
}

export function relativeUpdated(iso: string, now = Date.now()) {
  const delta = Math.max(0, now - new Date(iso).getTime());
  if (delta < 60_000) return 'Last updated just now';
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 60) return `Last updated ${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Last updated ${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.floor(hours / 24);
  return `Last updated ${days} ${days === 1 ? 'day' : 'days'} ago`;
}
