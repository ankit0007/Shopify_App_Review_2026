import {describe, expect, it} from 'vitest';
import {invalidateRatingCache, readRatingCache, writeRatingCache} from './rating-cache.server';
import {signRatingUrl, validateRatingRequest} from './rating-request';
import {
  assemblePublicRatings,
  formatAverage,
  includeInRating,
  parseProductIds,
  ratingAriaLabel,
  roundAverage,
  starFills,
  summarizeRatingCounts,
} from './rating';

const secret = 'rating-secret';

function signed(query: string) {
  const url = new URL(`https://shopifyreview.it3.in/api/public/ratings?${query}`);
  return signRatingUrl(url, secret);
}

describe('product rating calculation', () => {
  it('calculates a mixed average to one decimal', () => {
    const rating = summarizeRatingCounts([
      {rating: 5, count: 80},
      {rating: 4, count: 30},
      {rating: 3, count: 10},
    ]);
    expect(rating.reviewCount).toBe(120);
    expect(rating.averageRating).toBe(roundAverage(80 * 5 + 30 * 4 + 10 * 3, 120));
    expect(formatAverage(rating.averageRating)).toBe('4.6');
  });

  it('rounds 4.666 to 4.7 and 4.25 to 4.3', () => {
    expect(formatAverage(roundAverage(14, 3))).toBe('4.7');
    expect(formatAverage(roundAverage(17, 4))).toBe('4.3');
  });

  it('returns 5.0 for five-star reviews and null for none', () => {
    expect(formatAverage(summarizeRatingCounts([{rating: 5, count: 2}]).averageRating)).toBe('5.0');
    expect(summarizeRatingCounts([])).toEqual({averageRating: null, reviewCount: 0});
    expect(summarizeRatingCounts([{rating: 5, count: 1}]).reviewCount).toBe(1);
  });

  it('fills the last star partially for 4.8', () => {
    expect(starFills(1)).toEqual([1, 0, 0, 0, 0]);
    expect(starFills(2.5)).toEqual([1, 1, 0.5, 0, 0]);
    expect(starFills(3.2)).toEqual([1, 1, 1, 0.2, 0]);
    expect(starFills(3.8)).toEqual([1, 1, 1, 0.8, 0]);
    expect(starFills(4.2)).toEqual([1, 1, 1, 1, 0.2]);
    expect(starFills(4.5)).toEqual([1, 1, 1, 1, 0.5]);
    expect(starFills(4.8)).toEqual([1, 1, 1, 1, 0.8]);
    expect(starFills(5)).toEqual([1, 1, 1, 1, 1]);
    expect(starFills(null)).toEqual([0, 0, 0, 0, 0]);
  });

  it('excludes pending, rejected, deleted, and other shop or product reviews', () => {
    const shop = 'shop-a';
    const product = 'product-a';
    const reviews = [
      {status: 'APPROVED', deletedAt: null, shopId: shop, productId: product, rating: 5},
      {status: 'PENDING', deletedAt: null, shopId: shop, productId: product, rating: 1},
      {status: 'REJECTED', deletedAt: null, shopId: shop, productId: product, rating: 1},
      {status: 'APPROVED', deletedAt: new Date(), shopId: shop, productId: product, rating: 1},
      {status: 'APPROVED', deletedAt: null, shopId: 'shop-b', productId: product, rating: 1},
      {status: 'APPROVED', deletedAt: null, shopId: shop, productId: 'product-b', rating: 1},
    ];
    const included = reviews.filter((review) => includeInRating(review, shop, product));
    expect(summarizeRatingCounts(included.map((review) => ({rating: review.rating, count: 1})))).toEqual({
      averageRating: 5,
      reviewCount: 1,
    });
  });

  it('does not return another shop rating for the same product id', () => {
    const ratings = assemblePublicRatings({
      requestedIds: ['100'],
      ownedProductIds: [],
      countsByProductId: {100: [{rating: 5, count: 40}]},
    });
    expect(ratings['gid://shopify/Product/100']).toEqual({averageRating: null, reviewCount: 0});
  });

  it('batches owned products and describes the rating for assistive technology', () => {
    const ratings = assemblePublicRatings({
      requestedIds: ['1', '2'],
      ownedProductIds: ['1', '2'],
      countsByProductId: {
        1: [{rating: 5, count: 100}, {rating: 4, count: 26}],
        2: [{rating: 4, count: 30}, {rating: 5, count: 12}],
      },
    });
    expect(ratings['gid://shopify/Product/1'].reviewCount).toBe(126);
    expect(formatAverage(ratings['gid://shopify/Product/1'].averageRating)).toBe('4.8');
    expect(ratingAriaLabel(ratings['gid://shopify/Product/1'])).toBe('Rated 4.8 out of 5 stars from 126 reviews');
    expect(ratingAriaLabel({averageRating: null, reviewCount: 0})).toBe('No reviews yet');
    expect(JSON.stringify(ratings)).not.toMatch(/email|token|password|cuid/i);
  });
});

describe('public rating request validation', () => {
  it('rejects a missing shop, an invalid shop, and a missing signature', () => {
    expect(validateRatingRequest(new URL('https://shopifyreview.it3.in/api/public/ratings?productIds=1'), secret).ok).toBe(false);
    expect(validateRatingRequest(signed('shop=not-a-shop&productIds=1'), secret).code).toBe('INVALID_SHOP');
    const unsigned = new URL('https://shopifyreview.it3.in/api/public/ratings?shop=example.myshopify.com&productIds=1');
    expect(validateRatingRequest(unsigned, secret).code).toBe('INVALID_SIGNATURE');
  });

  it('rejects a bad signature, malformed ids, injection, markup, and oversized lists', () => {
    const tampered = signed('shop=example.myshopify.com&productIds=10');
    tampered.searchParams.set('productIds', '11');
    expect(validateRatingRequest(tampered, secret).code).toBe('INVALID_SIGNATURE');
    expect(parseProductIds('1 OR 1=1').code).toBe('MALFORMED_PRODUCT_ID');
    expect(parseProductIds('<script>alert(1)</script>').code).toBe('MALFORMED_PRODUCT_ID');
    expect(parseProductIds('gid://shopify/Product/nope').code).toBe('MALFORMED_PRODUCT_ID');
    expect(parseProductIds(Array.from({length: 51}, (_, index) => String(index + 1)).join(',')).code).toBe('TOO_MANY_PRODUCTS');
    expect(validateRatingRequest(new URL(`https://shopifyreview.it3.in/api/public/ratings?${'a'.repeat(4001)}`), secret).code).toBe('QUERY_TOO_LARGE');
  });

  it('accepts a signed batch of numeric ids and product gids', () => {
    const result = validateRatingRequest(signed('shop=example.myshopify.com&productIds=10,gid://shopify/Product/10,20'), secret);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.productIds).toEqual(['10', '20']);
  });
});

describe('rating cache', () => {
  it('expires and invalidates one product without dropping another shop', () => {
    writeRatingCache('a.myshopify.com', '10', {averageRating: 4.8, reviewCount: 126}, 1_000);
    writeRatingCache('b.myshopify.com', '10', {averageRating: 1, reviewCount: 1}, 1_000);
    expect(readRatingCache('a.myshopify.com', '10', 1_000)?.reviewCount).toBe(126);
    invalidateRatingCache('a.myshopify.com', '10');
    expect(readRatingCache('a.myshopify.com', '10', 1_000)).toBeUndefined();
    expect(readRatingCache('b.myshopify.com', '10', 1_000)?.reviewCount).toBe(1);
    expect(readRatingCache('b.myshopify.com', '10', 61_000)).toBeUndefined();
  });
});
