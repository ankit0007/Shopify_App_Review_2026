// @vitest-environment happy-dom
import {readFileSync} from 'node:fs';
import {afterEach, describe, expect, it, vi} from 'vitest';

const source = readFileSync('app/storefront/all-reviews-tab.js', 'utf8');

function payload(data: Record<string, unknown>) {
  return {success: true, data: {reviews: [], totalReviews: 0, nextCursor: null, ...data}};
}

async function boot(data: Record<string, unknown> | null, options?: {fail?: boolean}) {
  document.head.innerHTML = '<style>button { width: 100% !important; background: #111 !important; }</style>';
  document.body.innerHTML = '<div class="pr-reviews-tab-host" data-all-reviews-tab data-shop="demo.myshopify.com" hidden></div>';
  vi.stubGlobal('fetch', vi.fn(async () => {
    if (options?.fail) throw new Error('offline');
    return {ok: true, json: async () => payload(data || {})};
  }));
  window.eval(source);
  if (data?.showAllReviewsTab === false) {
    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });
    await Promise.resolve();
    return;
  }
  await vi.waitFor(() => {
    expect(document.querySelector('[data-pr-reviews-tab]')).toBeTruthy();
  });
}

describe('floating Reviews button', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
    document.head.innerHTML = '';
  });

  it('renders a shrink-wrapped button when the setting is on', async () => {
    await boot({
      showAllReviewsTab: true,
      reviewsButtonPosition: 'middle-right',
      reviewsButtonHorizontalOffset: 0,
      reviewsButtonVerticalOffset: 50,
      reviewsButtonOrientation: 'vertical',
    });
    const shell = document.querySelector<HTMLElement>('[data-pr-reviews-tab]')!;
    const face = shell.querySelector('button')!;
    expect(document.querySelectorAll('[data-pr-reviews-tab]')).toHaveLength(1);
    expect(shell.style.getPropertyValue('width')).toBe('max-content');
    expect(shell.style.getPropertyValue('height')).toBe('max-content');
    expect(shell.style.getPropertyValue('position')).toBe('fixed');
    expect(shell.style.getPropertyValue('background')).toBe('transparent');
    expect(shell.style.getPropertyValue('width')).not.toBe('100%');
    expect(shell.style.getPropertyPriority('width')).toBe('important');
    expect(face.style.getPropertyValue('width')).toBe('max-content');
    expect(shell.style.getPropertyValue('top')).toBe('50%');
    expect(shell.style.getPropertyValue('right')).toBe('0px');
    expect(shell.style.getPropertyValue('left')).toBe('auto');
    expect(shell.style.getPropertyValue('bottom')).toBe('auto');
    expect(shell.dataset.orientation).toBe('vertical');
  });

  it('does not render when the setting is off', async () => {
    await boot({showAllReviewsTab: false});
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(document.querySelector('[data-pr-reviews-tab]')).toBeNull();
  });

  it('does not create a second button when the embed script runs again', async () => {
    await boot({showAllReviewsTab: true});
    window.eval(source);
    await Promise.resolve();
    expect(document.querySelectorAll('[data-pr-reviews-tab]')).toHaveLength(1);
    const shell = document.querySelector<HTMLElement>('[data-pr-reviews-tab]')!;
    expect(shell.style.getPropertyValue('bottom')).toBe('auto');
    expect(shell.style.getPropertyValue('left')).toBe('auto');
    expect(shell.style.getPropertyValue('top')).toBe('50%');
    expect(shell.style.getPropertyValue('right')).toBe('0px');
    expect(shell.dataset.orientation).toBe('vertical');
  });

  it('keeps the default button available when the settings request fails', async () => {
    await boot(null, {fail: true});
    const shell = document.querySelector<HTMLElement>('[data-pr-reviews-tab]')!;
    expect(shell.style.getPropertyValue('width')).toBe('max-content');
    expect(shell.style.getPropertyValue('right')).toBe('0px');
    expect(shell.style.getPropertyValue('top')).toBe('50%');
  });

  it('opens the reviews dialog from the button', async () => {
    await boot({showAllReviewsTab: true});
    const face = document.querySelector<HTMLButtonElement>('.pr-reviews-tab__face')!;
    face.click();
    expect(document.querySelector('.sr-tab-modal')?.hasAttribute('hidden')).toBe(false);
  });
});
