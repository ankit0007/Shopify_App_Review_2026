// @vitest-environment happy-dom
import {readFileSync} from 'node:fs';
import {beforeEach, describe, expect, it, vi} from 'vitest';

const widgetSource = readFileSync('app/storefront/review-widgets.js', 'utf8');
const formSource = readFileSync('extensions/review-widgets/assets/review-form.js', 'utf8');

function installWidget(showForm = 'true') {
  document.body.innerHTML = `
    <a class="sr-rating__link" href="#shopify-product-reviews-42" aria-label="Be the first to review.">
      <span class="sr-rating__text">Be the first to review.</span>
    </a>
    <div class="shopify-review-rating" data-product-id="42" data-placement="section">
    </div>
    <section id="shopify-product-reviews-42" class="shopify-review-widget" data-product-id="42" data-shop="example.myshopify.com" data-show-form="${showForm}" data-form-src="/review-form.js" data-write="Write a review" data-submit="Submit review" data-product-title="Snowboard">
      <h2 class="sr__title">Customer Reviews</h2>
      <div data-summary></div>
      <div data-form-panel hidden></div>
      <div data-toolbar hidden></div>
      <ul data-list></ul>
      <button type="button" data-more hidden>Load more</button>
    </section>
  `;
  const rating = document.querySelector('.shopify-review-rating');
  rating?.append(document.querySelector('.sr-rating__link') as Node);
}

function loadScripts() {
  window.__productReviewsMounted = false;
  window.eval(formSource);
  window.eval(widgetSource);
}

describe('Be the first to review', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        data: {reviews: [], nextCursor: null, averageRating: null, totalReviews: 0, distribution: {}, showWriteReviewButton: false},
      }),
    })));
    installWidget();
    loadScripts();
  });

  it('opens the review submission form when the empty rating CTA is clicked', () => {
    const link = document.querySelector<HTMLAnchorElement>('.sr-rating__link');
    link?.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));
    const panel = document.querySelector<HTMLElement>('[data-form-panel]');
    expect(panel?.hidden).toBe(false);
    expect(panel?.getAttribute('role')).toBe('dialog');
    expect(panel?.querySelector('textarea[name="body"]')).toBeTruthy();
    expect(panel?.querySelector('input[name="displayName"]')).toBeTruthy();
    expect(panel?.querySelector('input[name="rating"]')).toBeTruthy();
    expect(panel?.querySelector('[type="submit"]')).toBeTruthy();
  });

  it('leaves the form closed when the rating already has reviews', () => {
    const link = document.querySelector<HTMLAnchorElement>('.sr-rating__link');
    link?.setAttribute('aria-label', 'Rated 4.0 out of 5 stars from 2 reviews');
    link?.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));
    expect(document.querySelector<HTMLElement>('[data-form-panel]')?.hidden).toBe(true);
  });

  it('does not open the form when the product block has the review form turned off', () => {
    document.body.innerHTML = '';
    window.__productReviewsMounted = false;
    installWidget('false');
    window.eval(widgetSource);
    document.querySelector('.sr-rating__link')?.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));
    expect(document.querySelector<HTMLElement>('[data-form-panel]')?.hidden).toBe(true);
  });
});

declare global {
  interface Window {
    __productReviewsMounted?: boolean;
    ShopifyReviewForm?: (panel: HTMLElement, root: HTMLElement, close: () => void) => void;
  }
}
