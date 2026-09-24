import {describe, expect, it} from 'vitest';
import {createReviewToken, hashToken} from './tokens.server';

describe('review tokens', () => {
  it('creates a random token that is stored as a one-way hash', () => {
    const first = createReviewToken();
    const second = createReviewToken();
    expect(first.token).not.toBe(second.token);
    expect(first.tokenHash).toBe(hashToken(first.token));
    expect(first.tokenHash).not.toContain(first.token);
  });
});
