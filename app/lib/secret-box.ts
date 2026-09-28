import {createCipheriv, createDecipheriv, createHash, randomBytes} from 'node:crypto';

function keyFrom(material: string) {
  return createHash('sha256').update(material).digest();
}

export function encryptSecret(value: string, keyMaterial: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFrom(keyMaterial), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptSecret(value: string, keyMaterial: string) {
  const [ivPart, tagPart, encryptedPart] = value.split('.');
  if (!ivPart || !tagPart || !encryptedPart) throw new Error('Encrypted value is invalid');
  const decipher = createDecipheriv('aes-256-gcm', keyFrom(keyMaterial), Buffer.from(ivPart, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
