import {createCipheriv, createDecipheriv, createHash, randomBytes} from 'node:crypto';
import {config} from '../config.server';

const key = createHash('sha256').update(config.ENCRYPTION_KEY).digest();

export function encryptData(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptData(value: string) {
  const [ivPart, tagPart, encryptedPart] = value.split('.');
  if (!ivPart || !tagPart || !encryptedPart) throw new Error('Encrypted value is invalid');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivPart, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
