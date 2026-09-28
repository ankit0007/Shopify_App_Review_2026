import {describe, expect, it} from 'vitest';
import {safeAuditMetadata} from './audit';

describe('platform audit metadata', () => {
  it('removes SMTP passwords and secrets before logging', () => {
    expect(safeAuditMetadata({
      host: 'smtp.example.com',
      password: 'secret',
      encryptedPassword: 'ciphertext',
      token: 'session',
    })).toEqual({host: 'smtp.example.com'});
  });
});