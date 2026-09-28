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
    .sort(([keyA, valueA], [keyB, valueB]) => {
      const left = `${keyA}=${valueA}`;
      const right = `${keyB}=${valueB}`;
      return left < right ? -1 : left > right ? 1 : 0;
    })
    .map(([key, value]) => `${key}=${value}`)
    .join('');
  const expected = createHmac('sha256', secret).update(pairs).digest('hex');
  return safeEqualHex(expected, signature);
}

export function encodePublicCursor(id: string) {
  return Buffer.from(id, 'utf8').toString('base64url');
}

export function decodePublicCursor(cursor: string) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(cursor)) return null;
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    return /^[a-z0-9]{8,32}$/i.test(decoded) ? decoded : null;
  } catch {
    return null;
  }
}
