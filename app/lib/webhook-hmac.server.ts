import {createHmac, timingSafeEqual} from 'node:crypto';

export function verifyWebhookHmac(rawBody: string, received: string | null, secret: string) {
  if (!received) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('base64');
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}
