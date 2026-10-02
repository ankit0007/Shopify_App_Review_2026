// @vitest-environment happy-dom
import {readFileSync} from 'node:fs';
import {act, createElement, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {describe, expect, it} from 'vitest';
import {ToggleSwitch} from './ui';

function Harness({initial = false}: {initial?: boolean}) {
  const [checked, setChecked] = useState(initial);
  return createElement(ToggleSwitch, {label: 'Show "Write a review" button', checked, onChange: setChecked, name: 'showWriteReviewButton'});
}

describe('ToggleSwitch', () => {
  it('turns on and off from the same switch and keeps the accessible state', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(createElement(Harness));
    });
    const input = host.querySelector<HTMLInputElement>('input[role="switch"]');
    expect(input?.checked).toBe(false);
    expect(input?.getAttribute('aria-checked')).toBe('false');
    expect(host.textContent).toContain('Off');
    await act(async () => {
      input!.click();
    });
    expect(host.querySelector<HTMLInputElement>('input[role="switch"]')?.checked).toBe(true);
    expect(host.textContent).toContain('On');
    input!.focus();
    expect(document.activeElement).toBe(input);
    await act(async () => {
      host.querySelector<HTMLInputElement>('input[role="switch"]')!.click();
    });
    expect(host.textContent).toContain('Off');
    root.unmount();
  });

  it('loads an existing on value', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(createElement(Harness, {initial: true}));
    });
    expect(host.querySelector<HTMLInputElement>('input')?.checked).toBe(true);
    expect(host.querySelector('input')?.getAttribute('aria-checked')).toBe('true');
    root.unmount();
  });
});

describe('merchant boolean controls', () => {
  it('uses the shared switch for every merchant on/off setting', () => {
    const settings = readFileSync('app/routes/app.settings.tsx', 'utf8');
    const reviews = readFileSync('app/routes/app.reviews.tsx', 'utf8');
    const dialog = readFileSync('app/components/add-review-dialog.tsx', 'utf8');
    for (const source of [settings, reviews, dialog]) expect(source).not.toContain('type="checkbox"');
    expect(settings).toContain('Enable Reviews Button');
    expect(settings).toContain('Automatic review-request emails');
    expect(reviews).toContain('Verified buyer');
    expect(dialog).toContain('name="featured"');
    expect(dialog).toContain('name="verifiedPurchase"');
    expect(dialog).toContain('value="true"');
  });
});
