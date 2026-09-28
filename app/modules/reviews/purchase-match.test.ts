import {describe, expect, it} from 'vitest';
import {purchaseMatchesReview} from './purchase-match';

const valid = {
  shopId: 'shop-a',
  orderShopId: 'shop-a',
  orderStatus: 'fulfilled',
  orderCustomerId: 'customer-a',
  customerId: 'customer-a',
  lineProductId: 'product-a',
  reviewProductId: 'product-a',
};

describe('verified purchase relationship', () => {
  it('accepts a fulfilled order line for the same shop, customer, and product', () => {
    expect(purchaseMatchesReview(valid)).toBe(true);
  });

  it('rejects another product, customer, shop, or an unfulfilled order', () => {
    expect(purchaseMatchesReview({...valid, reviewProductId: 'product-b'})).toBe(false);
    expect(purchaseMatchesReview({...valid, customerId: 'customer-b'})).toBe(false);
    expect(purchaseMatchesReview({...valid, orderShopId: 'shop-b'})).toBe(false);
    expect(purchaseMatchesReview({...valid, orderStatus: 'paid'})).toBe(false);
    expect(purchaseMatchesReview({...valid, customerId: null})).toBe(false);
  });
});
