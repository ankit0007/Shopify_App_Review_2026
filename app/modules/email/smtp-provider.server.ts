import nodemailer from 'nodemailer';
import type {EmailService} from './email.service.server';
import type {SmtpEncryptionMode} from './smtp-config';

export type SmtpConnection = {
  host: string;
  port: number;
  encryptionMode: SmtpEncryptionMode;
  username: string;
  password: string;
  fromName: string;
  fromEmail: string;
  replyTo?: string | null;
};

export interface SmtpTransport {
  verify(connection: SmtpConnection): Promise<void>;
  send(connection: SmtpConnection, message: {to: string; subject: string; html: string; text: string}): Promise<{response: string}>;
}

function transportOptions(connection: SmtpConnection) {
  return {
    host: connection.host,
    port: connection.port,
    secure: connection.encryptionMode === 'TLS',
    requireTLS: connection.encryptionMode === 'STARTTLS',
    auth: {user: connection.username, pass: connection.password},
    tls: {minVersion: 'TLSv1.2' as const},
  };
}

export class NodemailerSmtpTransport implements SmtpTransport {
  async verify(connection: SmtpConnection) {
    const transport = nodemailer.createTransport(transportOptions(connection));
    await transport.verify();
  }

  async send(connection: SmtpConnection, message: {to: string; subject: string; html: string; text: string}) {
    const transport = nodemailer.createTransport(transportOptions(connection));
    const result = await transport.sendMail({
      from: `"${connection.fromName}" <${connection.fromEmail}>`,
      to: message.to,
      replyTo: connection.replyTo || undefined,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    return {response: result.response || 'accepted'};
  }
}

export class SMTPEmailProvider implements EmailService {
  constructor(
    private readonly connection: SmtpConnection,
    private readonly transport: SmtpTransport,
  ) {}

  async send(message: {to: string; subject: string; html: string; text?: string}) {
    const result = await this.transport.send(this.connection, {
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text || '',
    });
    return {providerId: result.response.slice(0, 180)};
  }
}
