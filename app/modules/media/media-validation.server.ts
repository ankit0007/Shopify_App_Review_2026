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

export function readImageDimensions(contentType: string, bytes: Uint8Array) {
  if (contentType === 'image/png' && bytes.length >= 24) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return {width: view.getUint32(16), height: view.getUint32(20)};
  }
  if (contentType === 'image/jpeg') {
    let offset = 2;
    while (offset + 8 < bytes.length) {
      if (bytes[offset] !== 0xff) return null;
      const marker = bytes[offset + 1];
      const size = (bytes[offset + 2] << 8) + bytes[offset + 3];
      if (marker >= 0xc0 && marker <= 0xc3) {
        return {width: (bytes[offset + 7] << 8) + bytes[offset + 8], height: (bytes[offset + 5] << 8) + bytes[offset + 6]};
      }
      if (!size) return null;
      offset += 2 + size;
    }
  }
  return null;
}

export function assertSafeImageDimensions(dimensions: {width: number; height: number} | null) {
  if (!dimensions || dimensions.width < 1 || dimensions.height < 1 || dimensions.width > 8000 || dimensions.height > 8000) {
    throw new Error('Image dimensions are not allowed');
  }
  return dimensions;
}

export function hasAllowedSignature(contentType: string, bytes: Uint8Array) {
  if (contentType === 'image/png') {
    return bytes.length >= 8 &&
      bytes.slice(0, 8).every((value, index) => value === [137, 80, 78, 71, 13, 10, 26, 10][index]);
  }
  if (contentType === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8;
  if (contentType === 'image/webp') {
    return new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' &&
      new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP';
  }
  if (contentType === 'video/mp4' || contentType === 'video/quicktime') {
    return new TextDecoder().decode(bytes.slice(4, 8)) === 'ftyp';
  }
  return false;
}
