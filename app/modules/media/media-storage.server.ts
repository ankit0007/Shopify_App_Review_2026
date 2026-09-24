export type MediaUpload = {
  body: ReadableStream<Uint8Array> | Blob;
  contentType: string;
  size: number;
  storageKey: string;
};

export interface MediaStorageService {
  upload(input: MediaUpload): Promise<void>;
  delete(storageKey: string): Promise<void>;
  getSignedUrl(storageKey: string, expiresInSeconds?: number): Promise<string>;
}

export class UnconfiguredMediaStorage implements MediaStorageService {
  async upload(_input: MediaUpload): Promise<void> {
    throw new Error('Object storage is not configured');
  }

  async delete(_storageKey: string): Promise<void> {
    throw new Error('Object storage is not configured');
  }

  async getSignedUrl(_storageKey: string, _expiresInSeconds?: number): Promise<string> {
    throw new Error('Object storage is not configured');
  }
}
