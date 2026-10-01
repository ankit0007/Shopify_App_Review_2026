import { describe, expect, it } from 'vitest';
import { REVIEW_DELAY_DAYS, orderEmailAlreadySent, reviewEmailTrigger, reviewSendAt } from '../commerce/fulfillment-lines';
import { decideRetry } from '../email/retry';
import { createReviewToken, hashToken } from '../../lib/tokens.server';
import { reviewLinkState } from './request-access';
import {
  DEFAULT_TEST_RECIPIENT,
  parseOrderNumber,
  parseTestRecipient,
  productReviewDone,
  resolveReviewRecipient,
  reviewEmailAlreadySent,
  safeShopifyMessage,
  PROTECTED_CUSTOMER_DATA_REASON,
} from './request-test';

describe('review request test mode', () => {
  it('parses order #1003', () => {
    expect(parseOrderNumber('1003')).toBe('1003');
    expect(parseOrderNumber('#1003')).toBe('1003');
    expect(parseOrderNumber('  #1003 ')).toBe('1003');
    expect(parseOrderNumber('TEST-1001')).toBeNull();
  });

  it('uses the supplied test recipient and never the customer address', () => {
    expect(parseTestRecipient(`  ${DEFAULT_TEST_RECIPIENT} `)).toBe(DEFAULT_TEST_RECIPIENT);
    expect(resolveReviewRecipient({
      mode: 'test',
      customerEmail: 'customer@example.com',
      testRecipient: DEFAULT_TEST_RECIPIENT,
    })).toEqual({ok: true, recipient: DEFAULT_TEST_RECIPIENT, test: true});
  });

  it('blocks a normal request when Shopify does not provide a customer email', () => {
    expect(resolveReviewRecipient({mode: 'automatic', customerEmail: null, testRecipient: DEFAULT_TEST_RECIPIENT})).toEqual({
      ok: false,
      blocked: true,
      reason: PROTECTED_CUSTOMER_DATA_REASON,
    });
  });

  it('lets a TEST request continue with the supplied recipient when the customer email is unavailable', () => {
    expect(resolveReviewRecipient({mode: 'test', customerEmail: null, testRecipient: DEFAULT_TEST_RECIPIENT}).ok).toBe(true);
  });

  it('redacts secrets from Shopify errors', () => {
    expect(safeShopifyMessage('denied shpat_secret customer@shop.com')).toBe('denied [redacted] [redacted]');
  });

  it('schedules fulfilled and paid requests from 2 to 10 days and only once', () => {
    const event = new Date('2026-10-01T00:00:00.000Z');
    expect(REVIEW_DELAY_DAYS).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (const days of REVIEW_DELAY_DAYS) {
      expect(reviewSendAt(event, days).toISOString()).toBe(new Date(event.getTime() + days * 86_400_000).toISOString());
    }
    expect(reviewEmailTrigger('FULFILLMENT')).toBe('FULFILLMENT');
    expect(reviewEmailTrigger('PAID')).toBe('PAID');
    expect(orderEmailAlreadySent([{status: 'SENT', sentAt: event}])).toBe(true);
    expect(reviewEmailAlreadySent('SCHEDULED', null)).toBe(false);
  });

  it('retries a transient failure and stops after the retry limit', () => {
    expect(decideRetry({message: 'connection timeout', retryCount: 0, maxRetries: 3}).status).toBe('RETRYING');
    expect(decideRetry({message: 'connection timeout', retryCount: 3, maxRetries: 3}).status).toBe('FAILED');
    expect(decideRetry({message: 'authentication failed', retryCount: 0, maxRetries: 3}).status).toBe('FAILED');
  });

  it('keeps review tokens hashed and rejects an expired link', () => {
    const token = createReviewToken();
    expect(hashToken(token.token)).toBe(token.tokenHash);
    expect(token.tokenHash).not.toContain(token.token);
    expect(reviewLinkState({status: 'SENT', expiresAt: new Date('2020-01-01')})).toBe('expired');
    expect(reviewLinkState({status: 'SENT', expiresAt: new Date('2099-01-01')})).toBe('ready');
  });

  it('keeps each product review independent', () => {
    const products = [
      {id: '1', submitted: false},
      {id: '2', submitted: false},
    ];
    expect(productReviewDone(products[0], {productId: '1', submitted: true})).toBe(true);
    expect(productReviewDone(products[1], {productId: '1', submitted: true})).toBe(false);
    expect(productReviewDone({id: '2', submitted: true}, null)).toBe(true);
  });
});
