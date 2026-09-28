import {createHmac} from 'node:crypto';
import {describe, expect, it} from 'vitest';
import {decodePublicCursor, encodePublicCursor, verifyAppProxySignature} from './shopify-signatures.server';

describe('Shopify App Proxy signatures', () => {
  it('accepts a valid canonical query signature', () => {
    const secret = 'proxy-secret';
    const url = new URL('https://example.test/apps/reviews?shop=example.myshopify.com&timestamp=1710000000');
    const canonical = 'shop=example.myshopify.comtimestamp=1710000000';
    const signature = createHmac('sha256', secret).update(canonical).digest('hex');
    url.searchParams.set('signature', signature);
    expect(verifyAppProxySignature(url, secret)).toBe(true);
  });

  it('rejects missing, altered, or mismatched signatures', () => {
    const url = new URL('https://example.test/apps/reviews?shop=example.myshopify.com&signature=invalid');
    expect(verifyAppProxySignature(url, 'proxy-secret')).toBe(false);
    url.searchParams.set('signature', '0'.repeat(64));
    url.searchParams.set('timestamp', '1710000000');
    expect(verifyAppProxySignature(url, 'proxy-secret')).toBe(false);
  });

  it('only accepts cursors that decode to an internal identifier', () => {
    const secret = 'cursor-secret';
    const cursor = encodePublicCursor('cm1234567890123456789012', secret);
    expect(cursor).not.toContain('cm1234567890123456789012');
    expect(decodePublicCursor(cursor, secret)).toBe('cm1234567890123456789012');
    expect(decodePublicCursor(cursor, 'other-secret')).toBeNull();
    expect(decodePublicCursor('not-valid', secret)).toBeNull();
  });
});
