import {describe, expect, it} from 'vitest';
import {SMTPEmailProvider, type SmtpTransport} from './smtp-provider.server';

describe('SMTP email provider', () => {
  it('reports acceptance only when the transport accepts the message', async () => {
    const calls: string[] = [];
    const transport: SmtpTransport = {
      async verify() {
        calls.push('verify');
      },
      async send() {
        calls.push('send');
        return {response: '250 Accepted'};
      },
    };
    const provider = new SMTPEmailProvider({
      host: 'smtp.example.com',
      port: 587,
      encryptionMode: 'STARTTLS',
      username: 'mailer',
      password: 'secret',
      fromName: 'Reviews',
      fromEmail: 'reviews@example.com',
    }, transport);
    await expect(provider.send({to: 'person@example.com', subject: 'Hello', html: '<p>Hello</p>', text: 'Hello'})).resolves.toEqual({providerId: '250 Accepted'});
    expect(calls).toEqual(['send']);
  });

  it('does not report acceptance when the transport fails', async () => {
    const transport: SmtpTransport = {
      async verify() {
        throw new Error('SMTP authentication failed');
      },
      async send() {
        throw new Error('SMTP authentication failed');
      },
    };
    const provider = new SMTPEmailProvider({
      host: 'smtp.example.com',
      port: 587,
      encryptionMode: 'STARTTLS',
      username: 'mailer',
      password: 'secret',
      fromName: 'Reviews',
      fromEmail: 'reviews@example.com',
    }, transport);
    await expect(provider.send({to: 'person@example.com', subject: 'Hello', html: '<p>Hello</p>'})).rejects.toThrow('authentication failed');
  });
});
