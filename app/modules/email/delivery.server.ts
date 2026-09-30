import {createHash} from 'node:crypto';
import {config} from '../../config.server';
import {db} from '../../db.server';
import {decryptSecret} from '../../lib/secret-box';
import {assertSmtpMode, sanitizeSmtpError} from './smtp-config';
import {NodemailerSmtpTransport, SMTPEmailProvider, type SmtpConnection} from './smtp-provider.server';
import {renderTemplate, templateTypeForReminder, escapeHtml} from './template';
import {createEmailService, type EmailService} from './email.service.server';
import {blockedByAcceptedDelivery} from './delivery-state';
import {decideRetry} from './retry';

export function maskEmail(email: string) {
  const [local, domain] = email.toLowerCase().split('@');
  if (!local || !domain) return 'invalid-recipient';
  return `${local.slice(0, 1)}***@${domain}`;
}

export function hashEmail(email: string) {
  return createHash('sha256').update(email.toLowerCase()).digest('hex');
}

export async function loadEnabledSmtp(): Promise<SmtpConnection | null> {
  if (!config.EMAIL_CONFIG_ENCRYPTION_KEY) return null;
  try {
    const row = await db.smtpConfiguration.findUnique({where: {id: 'platform'}});
    if (!row?.enabled) return null;
    const mode = assertSmtpMode(row.encryptionMode, config.SMTP_ALLOW_INSECURE === 'true');
    if (mode === 'PLAIN') return null;
    return {
      host: row.host,
      port: row.port,
      encryptionMode: mode,
      username: row.username,
      password: decryptSecret(row.encryptedPassword, config.EMAIL_CONFIG_ENCRYPTION_KEY),
      fromName: row.fromName,
      fromEmail: row.fromEmail,
      replyTo: row.replyTo,
    };
  } catch {
    return null;
  }
}

export async function createDeliveryEmailService() {
  const smtp = await loadEnabledSmtp();
  if (!smtp) return createEmailService();
  return new SMTPEmailProvider(smtp, new NodemailerSmtpTransport());
}

export async function deliverReviewEmail(input: {
  emailService: EmailService;
  shopId: string;
  shopDomain: string;
  reviewRequestId: string;
  reminderCount: number;
  recipient: string;
  productName: string;
  reviewUrl: string;
  unsubscribeUrl: string;
  secrets: string[];
}) {
  const templateType = templateTypeForReminder(input.reminderCount);
  const alreadyAccepted = await db.emailDelivery.findFirst({
    where: {reviewRequestId: input.reviewRequestId, templateType, status: 'ACCEPTED'},
    select: {id: true},
  });
  if (blockedByAcceptedDelivery(alreadyAccepted ? 'ACCEPTED' : null)) return {status: 'ACCEPTED' as const, providerId: null};
  const rendered = await renderStoredTemplate(templateType, {
    shopName: input.shopDomain,
    customerName: 'Customer',
    productName: input.productName,
    reviewUrl: input.reviewUrl,
    unsubscribeUrl: input.unsubscribeUrl,
  });
  const message = rendered ?? {
    subject: 'How was your purchase from {{shopName}}?',
    html: `<p>Hi,</p><p>Your order has been fulfilled. We would love to hear what you think about the products you received.</p><p>${escapeHtml(input.productName)}</p><p><a href="${escapeHtml(input.reviewUrl)}">Write a review</a></p>`,
    text: `Hi Customer, your order has been fulfilled. Review ${input.productName}: ${input.reviewUrl}`,
  };
  const delivery = await db.emailDelivery.create({
    data: {
      shopId: input.shopId,
      reviewRequestId: input.reviewRequestId,
      templateType,
      recipientHash: hashEmail(input.recipient),
      recipientMasked: maskEmail(input.recipient),
      status: 'QUEUED',
    },
  });
  await db.emailDelivery.update({where: {id: delivery.id}, data: {status: 'PROCESSING'}});
  try {
    const provider = await input.emailService.send({
      to: input.recipient,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    await db.emailDelivery.update({
      where: {id: delivery.id},
      data: {status: 'ACCEPTED', acceptedAt: new Date(), providerResponse: provider.providerId ? sanitizeSmtpError(provider.providerId, input.secrets) : null},
    });
    return {status: 'ACCEPTED' as const, providerId: provider.providerId};
  } catch (error) {
    const previous = await db.emailDelivery.count({
      where: {reviewRequestId: input.reviewRequestId, templateType, status: {in: ['FAILED', 'RETRYING']}},
    });
    const message = error instanceof Error ? error.message : 'Email delivery unavailable';
    const decision = decideRetry({message, retryCount: previous, maxRetries: config.SMTP_MAX_RETRIES});
    const failureReason = sanitizeSmtpError(error, input.secrets);
    await db.emailDelivery.update({
      where: {id: delivery.id},
      data: {
        status: decision.status,
        failureReason,
        retryCount: previous + 1,
        nextAttemptAt: decision.status === 'RETRYING' ? new Date(Date.now() + decision.delayMs) : null,
      },
    });
    return {status: decision.status, failureReason, nextAttemptAt: decision.status === 'RETRYING' ? new Date(Date.now() + decision.delayMs) : null};
  }
}

export async function renderStoredTemplate(type: string, variables: Parameters<typeof renderTemplate>[1]) {
  const template = await db.platformEmailTemplate.findUnique({where: {type}});
  if (!template?.enabled) return null;
  return {
    subject: renderTemplate(template.subject, variables, 'text'),
    html: renderTemplate(template.htmlBody, variables, 'html'),
    text: renderTemplate(template.textBody, variables, 'text'),
  };
}
