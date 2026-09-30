import {describe, expect, it} from 'vitest';
import {verifyAppProxySignature} from '../../lib/shopify-signatures.server';
import {summarizeRatingCounts} from './rating';
import {cursorMatchesQuery, cursorPayload, parseListQuery, readCursorPayload} from './public-list';
import {decodeOpaqueCursor, encodeOpaqueCursor} from '../../lib/shopify-signatures.server';
import {globalApprovedWhere, handlesByProductId, isPublicShopReview, pageSlice, publicProductLink, publicShopDomain} from './global-reviews';

const reviews = [
  {shopId: 'shop-a', status: 'APPROVED', deletedAt: null, rating: 5},
  {shopId: 'shop-a', status: 'APPROVED', deletedAt: null, rating: 4},
  {shopId: 'shop-a', status: 'APPROVED', deletedAt: null, rating: 4},
  {shopId: 'shop-a', status: 'REJECTED', deletedAt: null, rating: 1},
  {shopId: 'shop-a', status: 'PENDING', deletedAt: null, rating: 5},
  {shopId: 'shop-a', status: 'APPROVED', deletedAt: '2026-01-01T00:00:00.000Z', rating: 1},
  {shopId: 'shop-b', status: 'APPROVED', deletedAt: null, rating: 1},
];

describe('global storefront reviews', () => {
  it('aggregates only approved reviews for the current shop', () => {
    const visible = reviews.filter((review) => isPublicShopReview(review, 'shop-a'));
    expect(visible.map((review) => review.rating)).toEqual([5, 4, 4]);
    expect(summarizeRatingCounts(visible.map((review) => ({rating: review.rating, count: 1})))).toEqual({
      averageRating: 4.3,
      reviewCount: 3,
    });
    expect(globalApprovedWhere('shop-a')).toEqual({shopId: 'shop-a', status: 'APPROVED', deletedAt: null});
  });

  it('excludes rejected, pending, and deleted reviews', () => {
    expect(reviews.filter((review) => review.status === 'REJECTED').every((review) => !isPublicShopReview(review, 'shop-a'))).toBe(true);
    expect(reviews.filter((review) => review.deletedAt).every((review) => !isPublicShopReview(review, 'shop-a'))).toBe(true);
  });

  it('does not include another shop in the store-wide rating', () => {
    const otherShop = reviews.filter((review) => isPublicShopReview(review, 'shop-b'));
    expect(otherShop).toEqual([{shopId: 'shop-b', status: 'APPROVED', deletedAt: null, rating: 1}]);
    expect(reviews.filter((review) => isPublicShopReview(review, 'shop-a')).some((review) => review.shopId === 'shop-b')).toBe(false);
  });

  it('rejects a missing or invalid shop before any review query', () => {
    expect(publicShopDomain(null).ok).toBe(false);
    expect(publicShopDomain('not a shop').ok).toBe(false);
    expect(publicShopDomain('sftp-7qtjiorq.myshopify.com')).toEqual({ok: true, shop: 'sftp-7qtjiorq.myshopify.com'});
  });

  it('rejects an App Proxy request without a valid signature', () => {
    const url = new URL('https://shopifyreview.it3.in/api/public/reviews?shop=sftp-7qtjiorq.myshopify.com&format=json');
    expect(verifyAppProxySignature(url, 'proxy-secret')).toBe(false);
  });

  it('pages the global list without returning the extra lookahead row', () => {
    const rows = ['a', 'b', 'c'];
    expect(pageSlice(rows, 2)).toEqual({items: ['a', 'b'], hasMore: true});
    expect(pageSlice(rows, 3)).toEqual({items: rows, hasMore: false});
  });

  it('rejects a cursor issued for a different global sort or star filter', () => {
    const secret = 'test-secret';
    const encoded = encodeOpaqueCursor(cursorPayload('newest', null, 'cm1234567890123456789012'), secret);
    const payload = readCursorPayload(decodeOpaqueCursor(encoded, secret) ?? '');
    expect(cursorMatchesQuery(payload!, {sort: 'newest', rating: null})).toBe(true);
    expect(cursorMatchesQuery(payload!, {sort: 'highest', rating: null})).toBe(false);
    expect(cursorMatchesQuery(payload!, {sort: 'newest', rating: 5})).toBe(false);
  });

  it('accepts the existing star filter values', () => {
    expect(parseListQuery('newest', '5')).toEqual({ok: true, sort: 'newest', rating: 5});
    expect(parseListQuery('lowest', '1')).toEqual({ok: true, sort: 'lowest', rating: 1});
    expect(parseListQuery('newest', '0').ok).toBe(false);
  });

  it('links a review to its product only when the handle is still safe', () => {
    expect(publicProductLink({title: 'The Collection Snowboard: Liquid', handle: 'the-collection-snowboard-liquid'})).toEqual({
      title: 'The Collection Snowboard: Liquid',
      url: '/products/the-collection-snowboard-liquid',
    });
    expect(publicProductLink({title: 'Removed product', handle: null})).toEqual({title: 'Removed product', url: null});
    expect(publicProductLink({title: 'Broken', handle: '../admin'})).toEqual({title: 'Broken', url: null});
    expect(publicProductLink(null)).toBeNull();
  });

  it('reads a product handle from Shopify and ignores a deleted product', () => {
    const handles = handlesByProductId([
      {id: 'gid://shopify/Product/10746305609893', handle: 'the-collection-snowboard-liquid'},
      null,
      {id: 'gid://shopify/Product/12', handle: '../admin'},
    ]);
    expect(handles.get('10746305609893')).toBe('the-collection-snowboard-liquid');
    expect(handles.has('12')).toBe(false);
  });
});
