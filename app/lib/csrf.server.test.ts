import {describe, expect, it} from 'vitest';
import {isSameOrigin} from './csrf.server';

describe('CSRF origin checks', () => {
  it('allows same-origin and non-browser requests', () => {
    expect(isSameOrigin(new Request('https://app.test/review/token'))).toBe(true);
    expect(isSameOrigin(new Request('https://app.test/review/token', {headers: {origin: 'https://app.test'}}))).toBe(true);
  });

  it('allows the public https origin when nginx forwards the app over http', () => {
    expect(isSameOrigin(new Request('http://127.0.0.1:3500/app/settings', {
      headers: {
        origin: 'https://productreviews.it3.in',
        host: 'productreviews.it3.in',
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'productreviews.it3.in',
      },
    }))).toBe(true);
  });

  it('rejects a cross-origin browser mutation', () => {
    expect(isSameOrigin(new Request('https://app.test/review/token', {
      headers: {origin: 'https://attacker.test'},
    }))).toBe(false);
  });
});
