import {createHmac, timingSafeEqual} from 'node:crypto';

function safeEqualHex(expected: string, received: string) {
  const expectedBuffer = Buffer.from(expected, 'hex');
  const receivedBuffer = Buffer.from(received, 'hex');
  return expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer);
}

export function verifyAppProxySignature(url: URL, secret: string) {
  const signature = url.searchParams.get('signature');
  if (!signature) return false;

  const pairs = [...url.searchParams.entries()]
    .filter(([key]) => key !== 'signature')
    .sort(([keyA, valueA], [keyB, valueB]) =>
      `${keyA}=${valueA}`.localeCompare(`${keyB}=${valueB}`))
    .map(([key, value]) => `${key}=${value}`)
    .join('');
  const expected = createHmac('sha256', secret).update(pairs).digest('hex');
  return safeEqualHex(expected, signature);
}

export function encodePublicCursor(id: string) {
  return Buffer.from(id, 'utf8').toString('base64url');
}

export function decodePublicCursor(cursor: string) {
  try {
    return Buffer.from(cursor, 'base64url').toString('utf8');
  } catch {
    return null;
  }
}
