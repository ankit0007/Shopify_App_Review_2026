import {describe, expect, it} from 'vitest';
import {assertSafeImageDimensions, createTenantMediaKey, hasAllowedSignature, readImageDimensions, validateMediaMetadata} from './media-validation.server';

describe('media validation', () => {
  it('accepts safe supported metadata and creates tenant-scoped keys', () => {
    const result = validateMediaMetadata({filename: 'photo.jpg', contentType: 'image/jpeg', size: 100});
    expect(result.mediaType).toBe('IMAGE');
    expect(createTenantMediaKey('shop-a', 'review-a', 'photo.jpg')).toMatch(/^shop-a\/review-a\/.+\.jpg$/);
  });

  it('rejects mismatched extensions, traversal, and oversized files', () => {
    expect(() => validateMediaMetadata({filename: 'photo.exe', contentType: 'image/jpeg', size: 100})).toThrow();
    expect(() => validateMediaMetadata({filename: '../photo.jpg', contentType: 'image/jpeg', size: 100})).toThrow();
    expect(() => validateMediaMetadata({filename: 'photo.jpg', contentType: 'image/jpeg', size: 11 * 1024 * 1024})).toThrow();
  });

  it('checks image magic bytes', () => {
    expect(hasAllowedSignature('image/jpeg', new Uint8Array([0xff, 0xd8, 0xff]))).toBe(true);
    expect(hasAllowedSignature('image/jpeg', new Uint8Array([0, 1, 2]))).toBe(false);
  });

  it('checks complete WebP and ISO-base media signatures', () => {
    const webp = new Uint8Array([...new TextEncoder().encode('RIFF'), 0, 0, 0, 0, ...new TextEncoder().encode('WEBP')]);
    const mp4 = new Uint8Array([0, 0, 0, 0, ...new TextEncoder().encode('ftyp')]);
    expect(hasAllowedSignature('image/webp', webp)).toBe(true);
    expect(hasAllowedSignature('video/mp4', mp4)).toBe(true);
    expect(hasAllowedSignature('image/webp', new TextEncoder().encode('RIFFbad!'))).toBe(false);
  });

  it('reads and limits image dimensions', () => {
    const png = new Uint8Array(24);
    png.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
    const view = new DataView(png.buffer);
    view.setUint32(16, 1200);
    view.setUint32(20, 800);
    expect(readImageDimensions('image/png', png)).toEqual({width: 1200, height: 800});
    expect(() => assertSafeImageDimensions({width: 9000, height: 10})).toThrow();
  });
});
