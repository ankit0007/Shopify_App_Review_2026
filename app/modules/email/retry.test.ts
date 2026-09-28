import {describe, expect, it} from 'vitest';
import {decideRetry} from './retry';

describe('SMTP retry policy', () => {
  it('retries transient failures with a delay and stops at the maximum', () => {
    expect(decideRetry({message: 'connection timed out', retryCount: 0, maxRetries: 3}).status).toBe('RETRYING');
    expect(decideRetry({message: 'connection timed out', retryCount: 3, maxRetries: 3}).status).toBe('FAILED');
  });

  it('does not retry authentication or invalid recipient failures', () => {
    expect(decideRetry({message: 'SMTP authentication failed', retryCount: 0, maxRetries: 3}).status).toBe('FAILED');
    expect(decideRetry({message: 'invalid recipient', retryCount: 0, maxRetries: 3}).status).toBe('FAILED');
  });
});
