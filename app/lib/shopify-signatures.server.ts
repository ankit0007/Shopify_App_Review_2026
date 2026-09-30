import {createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual} from 'node:crypto';

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

function cursorKey(secret: string) {
  return createHash('sha256').update(secret).digest();
}

function encryptCursor(value: string, secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', cursorKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function encodePublicCursor(id: string, secret: string) {
  if (!/^[a-z0-9]{8,32}$/i.test(id)) throw new Error('Cursor id is invalid');
  return encryptCursor(id, secret);
}

export function encodeOpaqueCursor(value: string, secret: string) {
  return encryptCursor(value, secret);
}

export function decodeOpaqueCursor(cursor: string, secret: string) {
  const [ivPart, tagPart, encryptedPart] = cursor.split('.');
  if (!ivPart || !tagPart || !encryptedPart) return null;
  try {
    const decipher = createDecipheriv('aes-256-gcm', cursorKey(secret), Buffer.from(ivPart, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedPart, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return null;
  }
}

export function decodePublicCursor(cursor: string, secret: string) {
  const [ivPart, tagPart, encryptedPart] = cursor.split('.');
  if (!ivPart || !tagPart || !encryptedPart) return null;
  try {
    const decipher = createDecipheriv('aes-256-gcm', cursorKey(secret), Buffer.from(ivPart, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
    const decoded = Buffer.concat([
      decipher.update(Buffer.from(encryptedPart, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
    return /^[a-z0-9]{8,32}$/i.test(decoded) ? decoded : null;
  } catch {
    return null;
  }
}
