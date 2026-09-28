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
  const [total, approved, pending, rejected, verified, ratings, distribution, photoReviews, videoReviews, requestsSent, requestsSubmitted] = await Promise.all([
    db.review.count({where: {shopId, deletedAt: null}}),
    db.review.count({where: {shopId, status: 'APPROVED', deletedAt: null}}),
    db.review.count({where: {shopId, status: 'PENDING', deletedAt: null}}),
    db.review.count({where: {shopId, status: 'REJECTED', deletedAt: null}}),
    db.review.count({where: {shopId, status: 'APPROVED', verifiedPurchase: true, deletedAt: null}}),
    db.review.aggregate({where: {shopId, status: 'APPROVED', deletedAt: null}, _avg: {rating: true}}),
    db.review.groupBy({by: ['rating'], where: {shopId, status: 'APPROVED', deletedAt: null}, _count: {_all: true}}),
    db.reviewMedia.count({where: {type: 'IMAGE', review: {shopId, deletedAt: null}}}),
    db.reviewMedia.count({where: {type: 'VIDEO', review: {shopId, deletedAt: null}}}),
    db.reviewRequest.count({where: {shopId, status: {in: ['SENT', 'OPENED', 'CLICKED', 'SUBMITTED']}}}),
    db.reviewRequest.count({where: {shopId, status: 'SUBMITTED'}}),
  ]);
  const ratingDistribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0};
  for (const row of distribution) {
    if (row.rating >= 1 && row.rating <= 5) ratingDistribution[row.rating as 1 | 2 | 3 | 4 | 5] = row._count._all;
  }
  return {
    total,
    approved,
    pending,
    rejected,
    verified,
    averageRating: ratings._avg.rating ?? 0,
    ratingDistribution,
    photoReviews,
    videoReviews,
    requestsSent,
    requestsSubmitted,
    requestConversion: requestsSent > 0 ? requestsSubmitted / requestsSent : null,
  };
}
