import {randomUUID} from 'node:crypto';

const limits = {
  image: 10 * 1024 * 1024,
  video: 100 * 1024 * 1024,
};

const allowed = new Map([
  ['image/jpeg', {type: 'IMAGE', extensions: ['.jpg', '.jpeg'], maxBytes: limits.image}],
  ['image/png', {type: 'IMAGE', extensions: ['.png'], maxBytes: limits.image}],
  ['image/webp', {type: 'IMAGE', extensions: ['.webp'], maxBytes: limits.image}],
  ['video/mp4', {type: 'VIDEO', extensions: ['.mp4'], maxBytes: limits.video}],
  ['video/quicktime', {type: 'VIDEO', extensions: ['.mov'], maxBytes: limits.video}],
]);

export function validateMediaMetadata(input: {filename: string; contentType: string; size: number}) {
  const extension = input.filename.slice(input.filename.lastIndexOf('.')).toLowerCase();
  const rule = allowed.get(input.contentType);
  if (!rule || !rule.extensions.includes(extension)) {
    throw new Error('Unsupported media type');
  }
  if (!Number.isSafeInteger(input.size) || input.size <= 0 || input.size > rule.maxBytes) {
    throw new Error('Media file is too large');
  }
  if (/[\/\\]|\.{2}|[\u0000-\u001f]/.test(input.filename)) {
    throw new Error('Invalid filename');
  }
  return {mediaType: rule.type as 'IMAGE' | 'VIDEO', extension};
}

export function createTenantMediaKey(shopId: string, reviewId: string, filename: string) {
  const extension = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  return `${shopId}/${reviewId}/${randomUUID()}${extension}`;
}

export function hasAllowedSignature(contentType: string, bytes: Uint8Array) {
  if (contentType === 'image/png') {
    return bytes.length >= 8 &&
      bytes.slice(0, 8).every((value, index) => value === [137, 80, 78, 71, 13, 10, 26, 10][index]);
  }
  if (contentType === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8;
  if (contentType === 'image/webp') return new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF';
  if (contentType === 'video/mp4') return new TextDecoder().decode(bytes.slice(4, 8)) === 'ftyp';
  return false;
}
