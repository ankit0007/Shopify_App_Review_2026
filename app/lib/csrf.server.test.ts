import {describe, expect, it} from 'vitest';
import {isSameOrigin} from './csrf.server';

describe('CSRF origin checks', () => {
  it('allows same-origin and non-browser requests', () => {
    expect(isSameOrigin(new Request('https://app.test/review/token'))).toBe(true);
    expect(isSameOrigin(new Request('https://app.test/review/token', {headers: {origin: 'https://app.test'}}))).toBe(true);
  });

  it('rejects a cross-origin browser mutation', () => {
    expect(isSameOrigin(new Request('https://app.test/review/token', {
      headers: {origin: 'https://attacker.test'},
    }))).toBe(false);
  });
});
