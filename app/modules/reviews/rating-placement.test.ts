import {describe, expect, it} from 'vitest';
import {
  chooseInsertion,
  chunkIds,
  formatReviewCount,
  idsToRequest,
  mutationNeedsScan,
  numericProductId,
  productHandleFromHref,
  productPageEmbedSuppressed,
  rememberMounted,
  shouldInjectCard,
} from './rating-placement';

describe('product rating placement', () => {
  it('resolves a product id from a numeric id or a product gid, and rejects malformed ids', () => {
    expect(numericProductId('42')).toBe('42');
    expect(numericProductId('gid://shopify/Product/42')).toBe('42');
    expect(numericProductId('1 OR 1=1')).toBeNull();
    expect(numericProductId('<script>alert(1)</script>')).toBeNull();
    expect(numericProductId('gid://shopify/Product/nope')).toBeNull();
    expect(numericProductId('')).toBeNull();
  });

  it('reads a product handle from a product url and ignores titles and unsafe urls', () => {
    expect(productHandleFromHref('/products/snow-board')).toBe('snow-board');
    expect(productHandleFromHref('/collections/all/products/snow-board?variant=1')).toBe('snow-board');
    expect(productHandleFromHref('https://store.example/en/products/Snow-Board')).toBe('snow-board');
    expect(productHandleFromHref('/products/')).toBeNull();
    expect(productHandleFromHref('javascript:alert(1)')).toBeNull();
    expect(productHandleFromHref('Blue Snowboard')).toBeNull();
  });

  it('requests each product id once, in batches of 50, skipping ids already cached', () => {
    const ids = Array.from({length: 51}, (_, index) => String(index + 1));
    expect(chunkIds(ids).map((chunk) => chunk.length)).toEqual([50, 1]);
    expect(idsToRequest(['10', '10', 'gid://shopify/Product/11', 'bad', '12'], new Set(['10']))).toEqual(['11', '12']);
  });

  it('places a card rating after the title, then before the price, then in the info container', () => {
    expect(chooseInsertion({
      hasTitle: true, titleInMedia: false, hasPrice: true, priceInMedia: false, hasInfo: true, infoInMedia: false,
    })).toBe('after-title');
    expect(chooseInsertion({
      hasTitle: true, titleInMedia: true, hasPrice: true, priceInMedia: false, hasInfo: true, infoInMedia: false,
    })).toBe('before-price');
    expect(chooseInsertion({
      hasTitle: false, titleInMedia: false, hasPrice: true, priceInMedia: true, hasInfo: true, infoInMedia: false,
    })).toBe('in-info');
    expect(chooseInsertion({
      hasTitle: false, titleInMedia: false, hasPrice: false, priceInMedia: false, hasInfo: true, infoInMedia: true,
    })).toBe('skip');
  });

  it('keeps the product-page block authoritative and does not inject a second rating', () => {
    const sectionIds = new Set(['9']);
    expect(productPageEmbedSuppressed('product', '9', sectionIds)).toBe(true);
    expect(productPageEmbedSuppressed('collection', '9', sectionIds)).toBe(false);
    expect(shouldInjectCard({
      mounted: false, alreadyHasRating: false, productId: '9', pageType: 'product', sectionProductIds: sectionIds,
    })).toBe(false);
    expect(shouldInjectCard({
      mounted: false, alreadyHasRating: true, productId: '8', pageType: 'collection', sectionProductIds: sectionIds,
    })).toBe(false);
  });

  it('mounts a dynamically inserted card once and ignores mutations caused by the rating itself', () => {
    const mounted = new Set<string>();
    expect(rememberMounted(mounted, '4')).toBe(true);
    expect(rememberMounted(mounted, '4')).toBe(false);
    expect(shouldInjectCard({
      mounted: false, alreadyHasRating: false, productId: '5', pageType: 'search', sectionProductIds: new Set(),
    })).toBe(true);
    expect(shouldInjectCard({
      mounted: true, alreadyHasRating: false, productId: '5', pageType: 'search', sectionProductIds: new Set(),
    })).toBe(false);
    expect(mutationNeedsScan(['rating', 'text'])).toBe(false);
    expect(mutationNeedsScan(['other'])).toBe(true);
  });

  it('formats the review count without inventing a rating', () => {
    expect(formatReviewCount(126, 'words')).toBe('126 reviews');
    expect(formatReviewCount(1, 'words')).toBe('1 review');
    expect(formatReviewCount(12, 'compact')).toBe('(12)');
  });
});
