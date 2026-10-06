import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

const extensionRoot = 'extensions/review-widgets';

function source(path: string) {
  return readFileSync(`${extensionRoot}/${path}`, 'utf8');
}

describe('storefront widget safety', () => {
  it('keeps the review widget script under the theme app extension limit', () => {
    const asset = source('assets/review-widgets.js');
    expect(asset.length).toBeLessThan(10_000);
    expect(asset).toContain('shopify-product-reviews-');
    expect(asset).toContain('Rated ');
  });

  it('loads the floating Reviews button only from the Product Reviews app embed', () => {
    const button = source('blocks/reviews-button.liquid');
    const ratingEmbed = source('blocks/rating-embed.liquid');
    expect(button).toContain('"name": "Product Reviews"');
    expect(button).toContain('"target": "body"');
    expect(button).toContain('"javascript": "all-reviews-tab.js"');
    expect(button).toContain('"stylesheet": "review-widgets.css"');
    expect(button).toContain('pr-reviews-tab-host');
    expect(button).toContain('all-reviews-tab.js');
    const css = source('assets/review-widgets.css');
    expect(css).toContain('.pr-reviews-tab {');
    expect(css).toContain('width: max-content !important;');
    expect(css).toContain('background: transparent !important;');
    expect(css).not.toMatch(/\.sr-tab\s*\{/);
    expect(css).toMatch(/\.sr-modal:not\(\[hidden\]\)\s*\{[^}]*max-width:\s*none !important;/);
    const script = readFileSync('app/storefront/all-reviews-tab.js', 'utf8');
    expect(script).toContain('data-pr-reviews-tab');
    expect(script).toContain("pin('width', 'max-content')");
    expect(script).toContain('showAllReviewsTab === false');
    expect(script).not.toContain("el('button', 'sr-tab')");
    expect(ratingEmbed).not.toContain('all-reviews-tab');
    expect(source('blocks/review-embed.liquid')).not.toContain('all-reviews-tab');
    expect(source('blocks/review-summary.liquid')).toContain('"name": "Product reviews"');
  });

  it('does not render the full review widget from the body embed', () => {
    const embed = source('blocks/review-embed.liquid');
    expect(embed).not.toMatch(/review-widget|data-review-form|Write a review/);
    expect(embed).toContain('"target": "body"');
    expect(source('blocks/review-summary.liquid')).toContain("render 'review-widget'");
    expect(source('snippets/product-rating.liquid')).not.toMatch(/data-review-form|textarea/);
  });

  it('registers the public ratings route beside the existing review route', () => {
    const routes = readFileSync('app/routes.ts', 'utf8');
    expect(routes).toContain("route('api/public/reviews', 'routes/api.public.reviews.ts')");
    expect(routes).toContain("route('api/public/ratings', 'routes/api.public.ratings.ts')");
    expect(routes).toContain("route('api/public/products/:productId/reviews'");
  });
});
