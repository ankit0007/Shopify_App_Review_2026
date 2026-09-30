import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

const extensionRoot = 'extensions/review-widgets';

function source(path: string) {
  return readFileSync(`${extensionRoot}/${path}`, 'utf8');
}

describe('storefront widget safety', () => {
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
