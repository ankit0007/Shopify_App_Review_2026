import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {invalidateRatingCache, readRatingCache, writeRatingCache} from './rating-cache.server';
import {histogramBarPercents} from './histogram';
import {includeInRating, summarizeRatingCounts} from './rating';
import {
  adminReviewCreateData,
  adminReviewRequestAllowed,
  canonicalProductId,
  distributionAfterReview,
  parseAdminProduct,
  parseAdminReviewForm,
  productOwnedByShop,
  productSearchQuery,
  shouldInvalidateRating,
} from './admin-review';

const valid = {rating: '5', title: 'Great board', body: 'This snowboard rides cleanly in soft snow.', displayName: 'Store Staff', status: 'APPROVED', featured: 'on'};

describe('admin add review', () => {
  it('opens an Add Review form on the merchant reviews page', () => {
    const page = readFileSync('app/routes/app.reviews.tsx', 'utf8');
    const dialog = readFileSync('app/components/add-review-dialog.tsx', 'utf8');
    expect(page).toContain('>Add review<');
    expect(page).toContain('<AddReviewDialog');
    expect(dialog).toContain('Search by title, handle, or SKU');
    expect(dialog).toContain('role="radiogroup"');
    expect(dialog).toContain('name="verifiedPurchase"');
    expect(dialog).toContain('off by default');
  });

  it('searches products for the authenticated shop only', () => {
    const route = readFileSync('app/routes/app.reviews.products.ts', 'utf8');
    const loader = route.slice(route.indexOf('export async function loader'));
    const search = readFileSync('app/modules/reviews/admin-review.server.ts', 'utf8');
    expect(loader.indexOf('authenticate.admin')).toBeGreaterThan(-1);
    expect(loader.indexOf('authenticate.admin')).toBeLessThan(loader.indexOf('searchShopProducts'));
    expect(route).not.toContain('searchParams.get(\'shop\')');
    expect(search).toContain('products(first: 8, query: $query)');
    expect(productSearchQuery('Snowboard')).toBe('title:*Snowboard* OR handle:*Snowboard* OR sku:*Snowboard*');
    expect(productSearchQuery('shop:other.myshopify.com')).not.toContain('shop:');
    expect(productSearchQuery('a')).toBeNull();
  });

  it('selects a product from the current shop and rejects another shop', () => {
    expect(parseAdminProduct({
      id: 'gid://shopify/Product/10746305609893',
      title: 'The Collection Snowboard: Liquid',
      handle: 'the-collection-snowboard-liquid',
      status: 'ACTIVE',
      priceRange: {minVariantPrice: {amount: '749.95', currencyCode: 'USD'}},
    })).toMatchObject({id: '10746305609893', title: 'The Collection Snowboard: Liquid', price: '$749.95'});
    expect(canonicalProductId('gid://shopify/Product/12')).toBe('12');
    expect(canonicalProductId('gid://shopify/Shop/12')).toBeNull();
    expect(canonicalProductId('12;drop')).toBeNull();
    expect(productOwnedByShop('shop-a', 'shop-a')).toBe(true);
    expect(productOwnedByShop('shop-b', 'shop-a')).toBe(false);
  });

  it('rejects ratings outside 1 to 5, including decimals and text', () => {
    for (const rating of [0, 6, 4.5, '4.5', 'five', '']) {
      const result = parseAdminReviewForm({...valid, rating});
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.fieldErrors.rating).toMatch(/1 to 5/);
    }
    expect(parseAdminReviewForm(valid).ok).toBe(true);
  });

  it('requires review text and a public display name', () => {
    const missingBody = parseAdminReviewForm({...valid, body: 'short'});
    const missingName = parseAdminReviewForm({...valid, displayName: '   '});
    expect(missingBody.ok).toBe(false);
    expect(missingName.ok).toBe(false);
    if (!missingBody.ok) expect(missingBody.fieldErrors.body).toBeTruthy();
    if (!missingName.ok) expect(missingName.fieldErrors.displayName).toBeTruthy();
  });

  it('rejects an unauthenticated or cross-site create before using a shop id from the browser', () => {
    const page = readFileSync('app/routes/app.reviews.tsx', 'utf8');
    expect(page.indexOf('authenticate.admin')).toBeLessThan(page.indexOf('intent') );
    expect(page).not.toContain('form.get(\'shopId\')');
    const foreign = new Request('https://shopifyreview.it3.in/app/reviews', {headers: {origin: 'https://evil.example'}});
    expect(adminReviewRequestAllowed(foreign)).toBe(false);
    expect(adminReviewRequestAllowed(new Request('https://shopifyreview.it3.in/app/reviews'))).toBe(true);
  });

  it('stores an admin review as not verified and records the admin source', () => {
    const created = adminReviewCreateData({
      shopId: 'shop-a',
      productId: 'product-a',
      data: {rating: 5, body: 'This snowboard rides cleanly in soft snow.', displayName: 'Store Staff', title: 'Great board', status: 'APPROVED', featured: true, verifiedPurchase: false},
      now: new Date('2026-10-01T00:00:00Z'),
    });
    expect(created.verifiedPurchase).toBe(false);
    expect(adminReviewCreateData({
      shopId: 'shop-a',
      productId: 'product-a',
      data: {rating: 5, body: 'This snowboard rides cleanly in soft snow.', displayName: 'Store Staff', status: 'PENDING', featured: false, verifiedPurchase: true},
    }).verifiedPurchase).toBe(true);
    expect(created.shopId).toBe('shop-a');
    expect(created.rating).toBe(5);
    expect(created.submittedAt.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(readFileSync('app/modules/reviews/admin-review.server.ts', 'utf8')).toContain("event: 'review_created'");
    expect(readFileSync('app/storefront/review-widgets.js', 'utf8')).not.toContain('Admin added');
  });

  it('includes an approved review in the rating and histogram, and leaves a pending review out', () => {
    const before = {'5': 1, '4': 2, '3': 0, '2': 1, '1': 0};
    const approved = distributionAfterReview(before, 5, 'APPROVED');
    const pending = distributionAfterReview(before, 5, 'PENDING');
    expect(approved).toEqual({5: 2, 4: 2, 3: 0, 2: 1, 1: 0});
    expect(pending).toEqual({5: 1, 4: 2, 3: 0, 2: 1, 1: 0});
    expect(histogramBarPercents(approved)['5']).toBe(100);
    expect(histogramBarPercents(before)['5']).toBe(50);
    const shop = 'shop-a';
    const product = 'product-a';
    const approvedReview = {status: 'APPROVED', deletedAt: null, shopId: shop, productId: product, rating: 5};
    const pendingReview = {...approvedReview, status: 'PENDING', rating: 1};
    expect(includeInRating(approvedReview, shop, product)).toBe(true);
    expect(includeInRating(pendingReview, shop, product)).toBe(false);
    expect(summarizeRatingCounts([{rating: 5, count: approved['5']}, {rating: 4, count: approved['4']}, {rating: 2, count: approved['2']}]).reviewCount).toBe(5);
  });

  it('invalidates only the approved product rating cache', () => {
    writeRatingCache('a.myshopify.com', '10746305609893', {averageRating: 3.8, reviewCount: 4}, 1_000);
    expect(shouldInvalidateRating('PENDING')).toBe(false);
    expect(shouldInvalidateRating('APPROVED')).toBe(true);
    invalidateRatingCache('a.myshopify.com', '10746305609893');
    expect(readRatingCache('a.myshopify.com', '10746305609893', 1_000)).toBeUndefined();
  });

  it('keeps moderation, public ratings, and customer submission on the existing paths', () => {
    const reviews = readFileSync('app/routes/app.reviews.tsx', 'utf8');
    const moderation = readFileSync('app/modules/reviews/moderation.service.server.ts', 'utf8');
    const ratings = readFileSync('app/modules/reviews/rating.server.ts', 'utf8');
    const submission = readFileSync('app/modules/reviews/review.service.server.ts', 'utf8');
    expect(reviews).toContain("'APPROVE', 'REJECT', 'HIDE', 'DELETE', 'FEATURE'");
    expect(moderation).toContain('invalidateRatingCache');
    expect(ratings).toContain("status: 'APPROVED'");
    expect(submission).toContain('reviewSubmissionSchema.parse');
    expect(submission).toContain('verifyPurchase');
    expect(readFileSync('app/routes.ts', 'utf8')).toContain("route('api/public/ratings'");
  });
});
