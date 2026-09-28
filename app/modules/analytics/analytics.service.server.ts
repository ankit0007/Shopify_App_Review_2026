import {db} from '../../db.server';

export type AnalyticsName =
  | 'REVIEW_SUBMITTED'
  | 'REVIEW_APPROVED'
  | 'REVIEW_REQUEST_SENT'
  | 'REVIEW_REQUEST_OPENED'
  | 'REVIEW_REQUEST_CLICKED'
  | 'REVIEW_REQUEST_FAILED'
  | 'WIDGET_IMPRESSION';

export async function recordAnalytics(input: {
  shopId: string;
  name: AnalyticsName;
  value?: number;
  metadata?: Record<string, string | number | boolean>;
}) {
  return db.analyticsEvent.create({
    data: {
      shopId: input.shopId,
      name: input.name,
      value: input.value,
      metadata: input.metadata,
    },
  });
}

export async function getReviewAnalytics(shopId: string) {
  const [total, approved, pending, verified, ratings] = await Promise.all([
    db.review.count({where: {shopId, deletedAt: null}}),
    db.review.count({where: {shopId, status: 'APPROVED', deletedAt: null}}),
    db.review.count({where: {shopId, status: 'PENDING', deletedAt: null}}),
    db.review.count({where: {shopId, status: 'APPROVED', verifiedPurchase: true, deletedAt: null}}),
    db.review.aggregate({where: {shopId, status: 'APPROVED', deletedAt: null}, _avg: {rating: true}}),
  ]);
  return {
    total,
    approved,
    pending,
    verified,
    averageRating: ratings._avg.rating ?? 0,
  };
}
