import {describe, expect, it} from 'vitest';
import {decryptSecret, encryptSecret} from '../../lib/secret-box';
import {assertSmtpMode, publicSmtpConfiguration, sanitizeSmtpError} from './smtp-config';

describe('SMTP configuration protection', () => {
  it('encrypts the password and keeps it out of the admin response', () => {
    const encryptedPassword = encryptSecret('smtp-password', 'test-encryption-key');
    expect(encryptedPassword).not.toContain('smtp-password');
    expect(decryptSecret(encryptedPassword, 'test-encryption-key')).toBe('smtp-password');
    const view = publicSmtpConfiguration({
      host: 'smtp.example.com',
      port: 587,
      username: 'mailer',
      encryptedPassword,
      encryptionMode: 'STARTTLS',
      fromName: 'Reviews',
      fromEmail: 'reviews@example.com',
      replyTo: null,
      enabled: false,
      lastTestedAt: null,
      lastTestStatus: null,
      lastTestError: null,
    });
    expect(JSON.stringify(view)).not.toContain('smtp-password');
    expect(JSON.stringify(view)).not.toContain(encryptedPassword);
    expect(view?.passwordConfigured).toBe(true);
  });

  it('sanitizes SMTP errors and rejects insecure modes by default', () => {
    expect(sanitizeSmtpError(new Error('535 password=smtp-password rejected'), ['smtp-password'])).not.toContain('smtp-password');
    expect(() => assertSmtpMode('PLAIN', false)).toThrow();
    expect(assertSmtpMode('STARTTLS', false)).toBe('STARTTLS');
  });
});
