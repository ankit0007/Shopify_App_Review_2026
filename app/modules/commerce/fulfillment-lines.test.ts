import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {adminPage, adminRangeLabel, ADMIN_PAGE_SIZE, pageCount} from '../admin/page';
import {automaticRequestsEnabled, latestFulfillmentMoment, normalizeReviewDelayDays, orderEmailAlreadySent, planOrderReviewEmail, requestStatusForLine, reviewableFulfilledLines, reviewRequestDelayDays, reviewSendAt, showWriteReviewButtonEnabled} from './fulfillment-lines';
import {reviewLinkState, sameOrderRequest} from '../reviews/request-access';
import {distributionAfterReview} from '../reviews/admin-review';
import {histogramBarPercents} from '../reviews/histogram';
import {includeInRating, summarizeRatingCounts} from '../reviews/rating';
import {invalidateRatingCache, readRatingCache, writeRatingCache} from '../reviews/rating-cache.server';

const order = {
  id: '100',
  fulfillment_status: 'partial',
  line_items: [
    {product_id: 1, title: 'Product A', quantity: 1, fulfillment_status: 'fulfilled'},
    {product_id: 2, title: 'Product B', quantity: 1, fulfillment_status: 'fulfilled'},
    {product_id: 3, title: 'Product C', quantity: 1, fulfillment_status: null},
    {product_id: 4, title: 'Gift Card', quantity: 1, gift_card: true, fulfillment_status: 'fulfilled'},
    {title: 'Shipping', quantity: 1, fulfillment_status: 'fulfilled'},
  ],
};

describe('shop review settings and fulfillment requests', () => {
  it('defaults a new shop to hidden write button and no automatic emails', () => {
    const schema = readFileSync('prisma/schema.prisma', 'utf8');
    expect(schema).toMatch(/showWriteReviewButton\s+Boolean\s+@default\(false\)/);
    expect(schema).toMatch(/automaticRequests\s+Boolean\s+@default\(false\)/);
    expect(schema).toMatch(/requestDelayDays\s+Int\s+@default\(2\)/);
    expect(normalizeReviewDelayDays(undefined)).toBe(2);
    expect(reviewRequestDelayDays(1)).toBeNull();
    expect(reviewRequestDelayDays(11)).toBeNull();
    expect(reviewRequestDelayDays(2)).toBe(2);
    expect(reviewRequestDelayDays(10)).toBe(10);
    expect(showWriteReviewButtonEnabled(undefined)).toBe(false);
    expect(showWriteReviewButtonEnabled(false)).toBe(false);
    expect(automaticRequestsEnabled(undefined)).toBe(false);
    expect(automaticRequestsEnabled(false)).toBe(false);
  });

  it('lets the merchant enable each setting separately', () => {
    expect(showWriteReviewButtonEnabled(true)).toBe(true);
    expect(automaticRequestsEnabled(true)).toBe(true);
    expect(showWriteReviewButtonEnabled(false)).toBe(false);
  });

  it('includes only fulfilled products and handles a later partial fulfillment', () => {
    expect(reviewableFulfilledLines(order).map((line) => line.title)).toEqual(['Product A', 'Product B']);
    const second = reviewableFulfilledLines({
      id: 'fulfillment-2',
      order_id: '100',
      status: 'success',
      line_items: [{product_id: 3, title: 'Product C', quantity: 1}],
    });
    expect(second.map((line) => line.productId)).toEqual(['3']);
    expect(requestStatusForLine(0)).toBe('SCHEDULED');
    expect(requestStatusForLine(1)).toBe('PENDING');
    const september1 = new Date('2026-09-01T10:00:00Z');
    const september3 = new Date('2026-09-03T10:00:00Z');
    const latest = latestFulfillmentMoment(latestFulfillmentMoment(null, september1), september3);
    expect(reviewSendAt(september1, 3).toISOString()).toBe('2026-09-04T10:00:00.000Z');
    expect(reviewSendAt(latest, 3).toISOString()).toBe('2026-09-06T10:00:00.000Z');
    expect(planOrderReviewEmail({automatic: false, emailAlreadySent: false, hasWaitingAnchor: false, productAlreadyRequested: false})).toBe('skip');
    expect(planOrderReviewEmail({automatic: true, emailAlreadySent: false, hasWaitingAnchor: false, productAlreadyRequested: false})).toBe('schedule');
    expect(planOrderReviewEmail({automatic: true, emailAlreadySent: false, hasWaitingAnchor: true, productAlreadyRequested: false})).toBe('attach');
    expect(planOrderReviewEmail({automatic: true, emailAlreadySent: true, hasWaitingAnchor: false, productAlreadyRequested: false})).toBe('attach');
    expect(planOrderReviewEmail({automatic: true, emailAlreadySent: true, hasWaitingAnchor: false, productAlreadyRequested: true})).toBe('keep');
    expect(orderEmailAlreadySent([{status: 'SENT', sentAt: september1}])).toBe(true);
    expect(orderEmailAlreadySent([{status: 'SCHEDULED'}])).toBe(false);
  });

  it('keeps webhook, email, token, and rating behavior on the existing paths', () => {
    const webhooks = readFileSync('app/routes/webhooks.ts', 'utf8');
    const worker = readFileSync('app/worker.ts', 'utf8');
    const sync = readFileSync('app/modules/commerce/sync.service.server.ts', 'utf8');
    const widget = readFileSync('app/storefront/review-widgets.js', 'utf8');
    const privacy = readFileSync('app/modules/privacy/privacy.service.server.ts', 'utf8');
    expect(webhooks).toContain('verifyWebhookHmac');
    expect(webhooks).toContain('P2002');
    expect(webhooks).not.toContain('deliverReviewEmail');
    expect(worker).toContain('fulfillments/create');
    expect(worker).toContain('deliverReviewEmail');
    expect(worker).toContain('/review-request/');
    expect(readFileSync('app/routes/review.$token.tsx', 'utf8')).toContain("status: 'SENT'");
    expect(sync).toContain('planOrderReviewEmail');
    expect(sync).toContain('reviewSendAt');
    expect(sync).toContain('automaticRequestsEnabled');
    expect(worker).toContain('automaticRequests: true');
    expect(readFileSync('app/routes/webhooks.ts', 'utf8')).toContain('Shop uninstalled');
    expect(widget).toContain('data.showWriteReviewButton !== true');
    expect(privacy).toContain('reviewRequest.deleteMany');
    expect(readFileSync('app/modules/reviews/review.service.server.ts', 'utf8')).toContain('verifyPurchase');
    expect(readFileSync('app/modules/reviews/moderation.service.server.ts', 'utf8')).toContain('invalidateRatingCache');
    expect(readFileSync('app/modules/email/email.service.server.ts', 'utf8')).toContain('Email provider is not configured');
  });

  it('rejects an invalid, expired, or cross-order review link', () => {
    expect(reviewLinkState(null)).toBe('invalid');
    expect(reviewLinkState({status: 'SENT', expiresAt: new Date('2020-01-01')}, new Date('2026-01-01'))).toBe('expired');
    expect(reviewLinkState({status: 'SENT', expiresAt: new Date('2027-01-01')}, new Date('2026-01-01'))).toBe('ready');
    const anchor = {shopId: 'shop-a', orderId: 'order-a', customerId: 'customer-a'};
    expect(sameOrderRequest(anchor, {...anchor})).toBe(true);
    expect(sameOrderRequest(anchor, {...anchor, shopId: 'shop-b'})).toBe(false);
    expect(sameOrderRequest(anchor, {...anchor, orderId: 'order-b'})).toBe(false);
  });

  it('pages the admin review list and keeps approved ratings on the existing calculation', () => {
    expect(ADMIN_PAGE_SIZE).toBe(20);
    expect(adminPage('2')).toBe(2);
    expect(adminPage('0')).toBe(1);
    expect(adminPage('nope')).toBe(1);
    expect(pageCount(21)).toBe(2);
    expect(pageCount(6, 5)).toBe(2);
    expect(adminRangeLabel(2, 6, 'review', 5)).toBe('6–6 of 6 reviews');
    expect(adminRangeLabel(1, 1, 'request')).toBe('1–1 of 1 request');
    const before = {'5': 1, '4': 2, '3': 0, '2': 1, '1': 0};
    const after = distributionAfterReview(before, 5, 'APPROVED');
    expect(after['5']).toBe(2);
    expect(histogramBarPercents(after)['5']).toBe(100);
    expect(includeInRating({status: 'PENDING', deletedAt: null, shopId: 'shop-a', productId: 'product-a'}, 'shop-a', 'product-a')).toBe(false);
    expect(summarizeRatingCounts([{rating: 5, count: 2}, {rating: 4, count: 2}, {rating: 2, count: 1}]).reviewCount).toBe(5);
    writeRatingCache('a.myshopify.com', '1', {averageRating: 3.8, reviewCount: 4}, 1_000);
    invalidateRatingCache('a.myshopify.com', '1');
    expect(readRatingCache('a.myshopify.com', '1', 1_000)).toBeUndefined();
  });
});
