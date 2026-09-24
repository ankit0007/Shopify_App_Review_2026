import {createHmac} from 'node:crypto';
import {describe, expect, it} from 'vitest';
import {verifyWebhookHmac} from '../lib/webhook-hmac.server';

describe('webhook HMAC validation', () => {
  it('accepts a valid signature and rejects tampering', () => {
    const body = '{"id":123}';
    const secret = 'test-secret';
    const signature = createHmac('sha256', secret).update(body).digest('base64');
    expect(verifyWebhookHmac(body, signature, secret)).toBe(true);
    expect(verifyWebhookHmac('{"id":124}', signature, secret)).toBe(false);
    expect(verifyWebhookHmac(body, null, secret)).toBe(false);
  });
});
