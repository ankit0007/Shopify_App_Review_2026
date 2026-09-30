import {config} from '../../config.server';

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

export class HttpMediaStorage implements MediaStorageService {
  constructor(
    private readonly endpoint: string,
    private readonly accessKey: string,
    private readonly secretKey: string,
    private readonly publicEndpoint: string,
  ) {}

  async upload(input: MediaUpload): Promise<void> {
    const body = input.body instanceof Blob ? input.body : input.body;
    const response = await fetch(`${this.endpoint}/objects/${encodeURIComponent(input.storageKey)}`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${this.secretKey}`,
        'x-storage-access-key': this.accessKey,
        'content-type': input.contentType,
        'content-length': String(input.size),
      },
      body,
    });
    if (!response.ok) throw new Error(`Object storage rejected upload (${response.status})`);
  }

  async delete(storageKey: string): Promise<void> {
    const response = await fetch(`${this.endpoint}/objects/${encodeURIComponent(storageKey)}`, {
      method: 'DELETE',
      headers: {
        authorization: `Bearer ${this.secretKey}`,
        'x-storage-access-key': this.accessKey,
      },
    });
    if (!response.ok && response.status !== 404) throw new Error(`Object storage rejected deletion (${response.status})`);
  }

  async getSignedUrl(storageKey: string, expiresInSeconds = 900): Promise<string> {
    const response = await fetch(`${this.endpoint}/sign`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.secretKey}`,
        'x-storage-access-key': this.accessKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({key: storageKey, expiresInSeconds, publicEndpoint: this.publicEndpoint}),
    });
    if (!response.ok) throw new Error(`Object storage rejected URL signing (${response.status})`);
    const body = await response.json() as {url?: string};
    if (!body.url) throw new Error('Object storage returned no signed URL');
    return body.url;
  }
}

function configuredStorage() {
  const endpoint = config.STORAGE_ENDPOINT;
  const bucket = config.STORAGE_BUCKET;
  const accessKey = config.STORAGE_ACCESS_KEY;
  const secretKey = config.STORAGE_SECRET_KEY;
  const publicEndpoint = config.STORAGE_PUBLIC_ENDPOINT;
  if (!endpoint || !bucket || !accessKey || !secretKey || !publicEndpoint) return null;
  return {endpoint, bucket, accessKey, secretKey, publicEndpoint};
}

export function isMediaStorageConfigured() {
  return configuredStorage() !== null;
}

export function createMediaStorage(): MediaStorageService {
  const storage = configuredStorage();
  if (storage) {
    return new HttpMediaStorage(
      `${storage.endpoint.replace(/\/$/, '')}/${encodeURIComponent(storage.bucket)}`,
      storage.accessKey,
      storage.secretKey,
      storage.publicEndpoint.replace(/\/$/, ''),
    );
  }
  return new UnconfiguredMediaStorage();
}
