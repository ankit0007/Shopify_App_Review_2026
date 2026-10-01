import {describe, expect, it} from 'vitest';
import {withEmbeddedQuery} from './embedded-query';

describe('embedded admin links', () => {
  it('keeps the Shopify session on the next review page', () => {
    const current = new URLSearchParams('embedded=1&shop=store.myshopify.com&host=abc&page=1');
    expect(withEmbeddedQuery('/app/reviews?page=2', current)).toBe('/app/reviews?page=2&shop=store.myshopify.com&host=abc&embedded=1');
  });

  it('does not replace a filter that is already on the link', () => {
    const current = new URLSearchParams('shop=store.myshopify.com&host=abc');
    expect(withEmbeddedQuery('/app/reviews?sort=highest&page=3', current)).toContain('sort=highest');
    expect(withEmbeddedQuery('/app/reviews?sort=highest&page=3', current)).toContain('shop=store.myshopify.com');
  });
});
