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
  it('renders active merchant settings without an unrestricted write-review control', () => {
    for (const label of [
      'Enable Reviews Button',
      'Automatic review-request emails',
      'Send the review email when',
      'Wait this many days after fulfillment',
      'Primary color',
      'Save settings',
    ]) {
      expect(settings).toContain(label);
    }
    const reviewsButton = section(settings, '>Reviews Button<', '>Review requests<');
    expect(reviewsButton).toContain('reviewsButtonEnabled ?');
    expect(reviewsButton).not.toContain('showWriteReviewButton');
    const requests = section(settings, '>Review requests<', '>Appearance<');
    expect(requests).not.toContain('automaticRequests ? (');
    expect(requests).toContain('reviewRequestTrigger');
    expect(requests).toContain('requestDelayDays');
  });

  it('loads and saves the existing settings keys without a second store', () => {
    for (const key of [
      'reviewsButtonEnabled',
      'automaticRequests',
      'reviewRequestTrigger',
      'requestDelayDays',
      'primaryColor',
    ]) {
      expect(settings).toContain(`${key}:`);
      expect(settings).toContain(`name="${key}"`);
    }
    expect(settings).toContain('shopSettings.upsert');
    expect(settings).not.toContain('name="reviewsButtonPosition"');
    expect(settings).not.toContain('name="reviewsButtonHorizontalOffset"');
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
