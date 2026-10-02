import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

const settings = readFileSync('app/routes/app.settings.tsx', 'utf8');
const shell = readFileSync('app/components/admin/ui.tsx', 'utf8');

function section(source: string, start: string, end: string) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  expect(from).toBeGreaterThan(-1);
  expect(to).toBeGreaterThan(from);
  return source.slice(from, to);
}

describe('settings page layout', () => {
  it('renders every saved merchant setting and keeps the write-review control outside the Reviews button toggle', () => {
    for (const label of [
      'Enable Reviews Button',
      'Show "Write a review" button',
      'Automatic review-request emails',
      'Send the review email when',
      'Wait this many days after fulfillment',
      'Primary color',
      'Save settings',
      'Live Preview',
      'Horizontal offset',
      'Vertical offset',
      'Button orientation',
    ]) {
      expect(settings).toContain(label);
    }
    const reviewsButton = section(settings, '>Reviews Button<', '>Review display<');
    expect(reviewsButton).toContain('reviewsButtonEnabled ?');
    expect(reviewsButton).not.toContain('showWriteReviewButton');
    const display = section(settings, '>Review display<', '>Review requests<');
    expect(display).toContain('showWriteReviewButton');
    expect(display).not.toContain('reviewsButtonEnabled ?');
    const requests = section(settings, '>Review requests<', '>Appearance<');
    expect(requests).not.toContain('automaticRequests ? (');
    expect(requests).toContain('reviewRequestTrigger');
    expect(requests).toContain('requestDelayDays');
  });

  it('loads and saves the existing settings keys without a second store', () => {
    for (const key of [
      'showWriteReviewButton',
      'reviewsButtonEnabled',
      'reviewsButtonPosition',
      'reviewsButtonHorizontalOffset',
      'reviewsButtonVerticalOffset',
      'reviewsButtonOrientation',
      'automaticRequests',
      'reviewRequestTrigger',
      'requestDelayDays',
      'primaryColor',
    ]) {
      expect(settings).toContain(`${key}:`);
      expect(settings).toContain(`name="${key}"`);
    }
    expect(settings).toContain('shopSettings.upsert');
    expect(settings).toContain("reviewsButtonPosition: validReviewButtonPosition");
    expect(settings).toContain(": 'middle-right'");
    expect(settings).toContain('reviewsButtonHorizontalOffset ?? 0');
    expect(settings).toContain('reviewsButtonVerticalOffset ?? 50');
    expect(settings).toContain(": 'vertical'");
  });

  it('uses the full admin width and a scrollable tab bar', () => {
    expect(settings).not.toContain('max-w-3xl');
    expect(settings).toContain('w-full min-w-0');
    expect(shell).toContain('max-w-[1440px]');
    expect(shell).toContain('overflow-x-auto');
    expect(shell).toContain('overflow-x-clip');
    expect(shell).toContain("to: '/app/settings'");
    expect(shell).toContain('whitespace-nowrap');
    expect(settings).toContain('grid-cols-3');
    expect(readFileSync('app/storefront/review-widgets.js', 'utf8')).toContain('shopify-product-reviews-');
  });
});
