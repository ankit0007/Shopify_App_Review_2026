import {describe, expect, it} from 'vitest';
import {createTenantMediaKey, hasAllowedSignature, validateMediaMetadata} from './media-validation.server';

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
});
