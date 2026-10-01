import {db} from '../../db.server';
import {reviewEmailTrigger} from '../commerce/fulfillment-lines';
import {summarizeRatingCounts} from '../reviews/rating';
import {emptyDistribution, productPerformance, reviewActivity, summarizeRequests, type RatingDistribution} from './dashboard-metrics';

export async function loadAdminDashboard(shopId: string) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [metrics, activity, products, recent, requests, settings, media] = await Promise.all([
    loadMetrics(shopId),
    loadActivity(shopId, since),
    loadProducts(shopId),
    loadRecent(shopId),
    loadRequests(shopId),
    loadSettings(shopId),
    loadMedia(shopId),
  ]);
  return {metrics, activity, products, recent, requests, settings, media, failed: [metrics, activity, products, recent, requests, settings, media].some((section) => section == null)};
}

async function loadMetrics(shopId: string) {
  try {
    const [total, approved, pending, rejected, hidden, verified, distribution] = await Promise.all([
      db.review.count({where: {shopId, deletedAt: null}}),
      db.review.count({where: {shopId, status: 'APPROVED', deletedAt: null}}),
      db.review.count({where: {shopId, status: 'PENDING', deletedAt: null}}),
      db.review.count({where: {shopId, status: 'REJECTED', deletedAt: null}}),
      db.review.count({where: {shopId, status: 'HIDDEN', deletedAt: null}}),
      db.review.count({where: {shopId, status: 'APPROVED', verifiedPurchase: true, deletedAt: null}}),
      db.review.groupBy({by: ['rating'], where: {shopId, status: 'APPROVED', deletedAt: null}, _count: {_all: true}}),
    ]);
    const ratingDistribution = emptyDistribution();
    for (const row of distribution) {
      if (row.rating >= 1 && row.rating <= 5) ratingDistribution[row.rating as 1 | 2 | 3 | 4 | 5] = row._count._all;
    }
    const summary = summarizeRatingCounts(distribution.map((row) => ({rating: row.rating, count: row._count._all})));
    return {total, approved, pending, rejected, hidden, verified, averageRating: summary.averageRating, ratingDistribution: ratingDistribution as RatingDistribution};
  } catch {
    return null;
  }
}

async function loadActivity(shopId: string, since: Date) {
  try {
    const rows = await db.$queryRaw<Array<{day: Date; count: number}>>`
      SELECT date_trunc('day', "submittedAt") AS day, COUNT(*)::int AS count
      FROM "Review"
      WHERE "shopId" = ${shopId} AND "deletedAt" IS NULL AND "submittedAt" >= ${since}
      GROUP BY 1
      ORDER BY 1
    `;
    return reviewActivity(rows.map((row) => ({
      day: new Date(row.day).toISOString().slice(0, 10),
      count: Number(row.count),
    }))) ?? [];
  } catch {
    return null;
  }
}

async function loadProducts(shopId: string) {
  try {
    const rows = await db.review.groupBy({
      by: ['productId', 'status', 'rating', 'verifiedPurchase'],
      where: {shopId, deletedAt: null},
      _count: {_all: true},
    });
    const ranked = productPerformance(rows.map((row) => ({
      productId: row.productId,
      status: row.status,
      rating: row.rating,
      verifiedPurchase: row.verifiedPurchase,
      count: row._count._all,
    })));
    if (!ranked.length) return [];
    const products = await db.product.findMany({
      where: {shopId, id: {in: ranked.map((product) => product.productId)}},
      select: {id: true, title: true, imageUrl: true, shopifyProductId: true},
    });
    const byId = new Map(products.map((product) => [product.id, product]));
    return ranked.flatMap((product) => {
      const record = byId.get(product.productId);
      if (!record) return [];
      return [{
        ...product,
        title: record.title,
        imageUrl: record.imageUrl,
        shopifyProductId: record.shopifyProductId,
      }];
    });
  } catch {
    return null;
  }
}

async function loadRecent(shopId: string) {
  try {
    return db.review.findMany({
      where: {shopId, deletedAt: null},
      orderBy: {submittedAt: 'desc'},
      take: 5,
      select: {
        id: true,
        rating: true,
        title: true,
        body: true,
        displayName: true,
        status: true,
        submittedAt: true,
        product: {select: {title: true}},
      },
    });
  } catch {
    return null;
  }
}

async function loadRequests(shopId: string) {
  try {
    const rows = await db.reviewRequest.groupBy({
      by: ['status'],
      where: {shopId},
      _count: {_all: true},
    });
    return summarizeRequests(Object.fromEntries(rows.map((row) => [row.status, row._count._all])));
  } catch {
    return null;
  }
}

async function loadSettings(shopId: string) {
  try {
    const settings = await db.shopSettings.findUnique({
      where: {shopId},
      select: {automaticRequests: true, reviewRequestTrigger: true, requestDelayDays: true, showWriteReviewButton: true},
    });
    return {
      automaticRequests: settings?.automaticRequests === true,
      reviewRequestTrigger: reviewEmailTrigger(settings?.reviewRequestTrigger),
      requestDelayDays: settings?.requestDelayDays ?? null,
      showWriteReviewButton: settings?.showWriteReviewButton === true,
    };
  } catch {
    return null;
  }
}

async function loadMedia(shopId: string) {
  try {
    const [photoReviews, videoReviews] = await Promise.all([
      db.reviewMedia.count({where: {type: 'IMAGE', review: {shopId, deletedAt: null}}}),
      db.reviewMedia.count({where: {type: 'VIDEO', review: {shopId, deletedAt: null}}}),
    ]);
    return {photoReviews, videoReviews};
  } catch {
    return null;
  }
}
