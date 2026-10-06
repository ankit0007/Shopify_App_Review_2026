import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {reviewLinkState, sameOrderRequest} from './request-access';

describe('review creation security', () => {
  it('removes the public product review creation path', () => {
    const route = readFileSync('app/routes/api.public.products.$productId.reviews.ts', 'utf8');
    const storefront = readFileSync('app/storefront/review-widgets.js', 'utf8');
    expect(route).toContain('REVIEW_REQUEST_REQUIRED');
    expect(route).not.toContain('db.review.create');
    expect(route).not.toContain('publicReviewSubmissionSchema');
    expect(storefront).not.toContain('openForm(root, button);');
    expect(storefront).toContain('Reviews can be submitted after purchase through our review request email.');
  });

  it('rejects invalid, expired, cancelled, and consumed request links', () => {
    expect(reviewLinkState(null)).toBe('invalid');
    expect(reviewLinkState({status: 'SENT', expiresAt: new Date('2020-01-01')})).toBe('expired');
    expect(reviewLinkState({status: 'CANCELLED', expiresAt: new Date('2099-01-01')})).toBe('invalid');
    expect(reviewLinkState({status: 'SUBMITTED', expiresAt: new Date('2099-01-01')})).toBe('ready');
  });

  it('binds a multi-product request to one store, order, and customer', () => {
    const anchor = {shopId: 'shop-a', orderId: 'order-a', customerId: 'customer-a'};
    expect(sameOrderRequest(anchor, anchor)).toBe(true);
    expect(sameOrderRequest(anchor, {...anchor, shopId: 'shop-b'})).toBe(false);
    expect(sameOrderRequest(anchor, {...anchor, orderId: 'order-b'})).toBe(false);
    expect(sameOrderRequest(anchor, {...anchor, customerId: 'customer-b'})).toBe(false);
    expect(sameOrderRequest({...anchor, orderId: null}, anchor)).toBe(false);
  });

  it('keeps merchant review creation disabled while moderation remains available', () => {
    const adminRoute = readFileSync('app/routes/app.reviews.tsx', 'utf8');
    const adminService = readFileSync('app/modules/reviews/admin-review.server.ts', 'utf8');
    const importer = readFileSync('app/modules/import-export/reviews-import.service.server.ts', 'utf8');
    expect(adminRoute).not.toContain('AddReviewDialog');
    expect(adminRoute).not.toContain('createAdminReview');
    expect(adminRoute).toContain("'APPROVE', 'REJECT', 'HIDE', 'DELETE', 'FEATURE'");
    expect(adminService).toContain('Customer reviews must be submitted through a secure review-request link.');
    expect(importer).toContain('Customer reviews cannot be imported or created by a merchant.');
  });

  it('keeps the authorized review-request form and pending moderation path', () => {
    const requestRoute = readFileSync('app/routes/review.$token.tsx', 'utf8');
    const service = readFileSync('app/modules/reviews/review.service.server.ts', 'utf8');
    expect(requestRoute).toContain('hashToken(token)');
    expect(requestRoute).toContain('reviewLinkState(anchor) !== \'ready\'');
    expect(requestRoute).toContain('sameOrderRequest(anchor, target)');
    expect(requestRoute).toContain('submitReview({');
    expect(service).toContain('reviewRequestId');
    expect(service).toContain("status: 'PENDING'");
    expect(service).toContain("status: {notIn: ['CANCELLED', 'SUBMITTED', 'EXPIRED']}");
  });
});
