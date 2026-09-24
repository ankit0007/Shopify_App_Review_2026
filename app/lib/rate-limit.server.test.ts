import {describe, expect, it} from 'vitest';
import {consumeRateLimit} from './rate-limit.server';

describe('process-local rate limiter', () => {
  it('allows the configured burst and rejects subsequent requests', () => {
    const first = consumeRateLimit('test-rate-limit', 2, 1000, 100);
    const second = consumeRateLimit('test-rate-limit', 2, 1000, 100);
    const third = consumeRateLimit('test-rate-limit', 2, 1000, 100);
    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
  });

  it('resets after the window', () => {
    expect(consumeRateLimit('test-rate-limit-reset', 1, 1000, 100).allowed).toBe(true);
    expect(consumeRateLimit('test-rate-limit-reset', 1, 1000, 1101).allowed).toBe(true);
  });
});
