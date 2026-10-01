import {describe, expect, it} from 'vitest';
import {
  distributionWidth,
  formatShare,
  productPerformance,
  reviewActivity,
  sharePercent,
  summarizeRequests,
} from './dashboard-metrics';

describe('admin dashboard metrics', () => {
  it('calculates totals, shares, and rating distribution from the supplied counts', () => {
    expect(formatShare(6, 7)).toBe('85.7%');
    expect(sharePercent(3, 6)).toBe(50);
    expect(formatShare(0, 0)).toBeNull();
    expect(distributionWidth(3, 6)).toBe(50);
    expect(distributionWidth(1, 0)).toBe(0);
  });

  it('aggregates product ratings from approved reviews only', () => {
    const products = productPerformance([
      {productId: 'b', status: 'APPROVED', rating: 4, verifiedPurchase: true, count: 3},
      {productId: 'b', status: 'APPROVED', rating: 2, verifiedPurchase: false, count: 1},
      {productId: 'b', status: 'PENDING', rating: 5, verifiedPurchase: false, count: 2},
      {productId: 'a', status: 'APPROVED', rating: 5, verifiedPurchase: true, count: 1},
      {productId: 'c', status: 'REJECTED', rating: 1, verifiedPurchase: false, count: 9},
    ]);
    expect(products.map((product) => product.productId)).toEqual(['c', 'b', 'a']);
    expect(products[1]).toMatchObject({total: 6, approved: 4, pending: 2, verified: 3, averageRating: 3.5});
    expect(products[2]?.averageRating).toBe(5);
    expect(productPerformance([])).toEqual([]);
  });

  it('calculates review-request conversion only when requests were sent', () => {
    expect(summarizeRequests({})).toMatchObject({hasData: false, conversion: null, sent: 0});
    expect(summarizeRequests({SENT: 4, SUBMITTED: 1, FAILED: 2, PENDING: 3})).toEqual({
      sent: 5,
      pending: 3,
      failed: 2,
      submitted: 1,
      conversion: 0.2,
      hasData: true,
    });
  });

  it('does not invent review activity from a single day', () => {
    expect(reviewActivity([{day: '2026-10-01', count: 4}])).toBeNull();
    expect(reviewActivity([
      {day: '2026-09-30', count: 2},
      {day: '2026-10-01', count: 1},
    ])).toHaveLength(2);
  });
});
