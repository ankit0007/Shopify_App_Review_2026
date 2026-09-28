import {config} from '../../config.server';

export type EmailMessage = {to: string; subject: string; html: string};

export interface EmailService {
  send(message: EmailMessage): Promise<{providerId?: string}>;
}

export class DisabledEmailService implements EmailService {
  async send(_message: EmailMessage): Promise<{providerId?: string}> {
    throw new Error('Email provider is not configured');
  }
}

export class HttpEmailService implements EmailService {
  constructor(
    private readonly endpoint: string,
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage): Promise<{providerId?: string}> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({...message, from: this.from}),
    });
    if (!response.ok) {
      throw new Error(`Email provider rejected message (${response.status})`);
    }
    const body = await response.json().catch(() => ({})) as {id?: string; providerId?: string};
    return {providerId: body.providerId ?? body.id};
  }
}

export function createEmailService(): EmailService {
  if (config.EMAIL_PROVIDER !== 'disabled' && config.EMAIL_API_URL && config.EMAIL_API_KEY && config.EMAIL_FROM) {
    return new HttpEmailService(config.EMAIL_API_URL, config.EMAIL_API_KEY, config.EMAIL_FROM);
  }
  return new DisabledEmailService();
}
