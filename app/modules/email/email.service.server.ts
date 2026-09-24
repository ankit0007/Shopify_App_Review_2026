export type EmailMessage = {to: string; subject: string; html: string};

export interface EmailService {
  send(message: EmailMessage): Promise<{providerId?: string}>;
}

export class DisabledEmailService implements EmailService {
  async send(_message: EmailMessage): Promise<{providerId?: string}> {
    throw new Error('Email provider is not configured');
  }
}
