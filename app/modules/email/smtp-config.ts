export type SmtpEncryptionMode = 'TLS' | 'STARTTLS';

export type StoredSmtpConfiguration = {
  host: string;
  port: number;
  username: string;
  encryptedPassword: string;
  encryptionMode: string;
  fromName: string;
  fromEmail: string;
  replyTo: string | null;
  enabled: boolean;
  lastTestedAt: Date | null;
  lastTestStatus: string | null;
  lastTestError: string | null;
};

export function publicSmtpConfiguration(config: StoredSmtpConfiguration | null) {
  if (!config) return null;
  return {
    host: config.host,
    port: config.port,
    username: config.username,
    encryptionMode: config.encryptionMode,
    fromName: config.fromName,
    fromEmail: config.fromEmail,
    replyTo: config.replyTo,
    enabled: config.enabled,
    passwordConfigured: Boolean(config.encryptedPassword),
    lastTestedAt: config.lastTestedAt,
    lastTestStatus: config.lastTestStatus,
    lastTestError: config.lastTestError,
  };
}

export function sanitizeSmtpError(error: unknown, secrets: string[] = []) {
  let message = error instanceof Error ? error.message : typeof error === 'string' ? error : 'SMTP request failed';
  for (const secret of secrets) {
    if (secret.length >= 3) message = message.split(secret).join('[redacted]');
  }
  message = message.replace(/pass(?:word)?\s*[=:]\s*\S+/gi, 'password=[redacted]');
  return message.slice(0, 300);
}

export function assertSmtpMode(mode: string, allowInsecure: boolean): SmtpEncryptionMode | 'PLAIN' {
  if (mode === 'TLS' || mode === 'STARTTLS') return mode;
  if (mode === 'PLAIN' && allowInsecure) return 'PLAIN';
  throw new Error('SMTP encryption mode is not allowed');
}
