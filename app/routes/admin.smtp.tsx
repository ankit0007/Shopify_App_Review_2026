import {Form, useActionData, useLoaderData, useOutletContext} from 'react-router';
import {z} from 'zod';
import {config} from '../config.server';
import {db} from '../db.server';
import {decryptSecret, encryptSecret} from '../lib/secret-box';
import {assertCsrf, requirePlatformAdmin, writePlatformAudit} from '../modules/admin/session.server';
import {hashEmail, maskEmail} from '../modules/email/delivery.server';
import {publicSmtpConfiguration, sanitizeSmtpError} from '../modules/email/smtp-config';
import {NodemailerSmtpTransport} from '../modules/email/smtp-provider.server';

const saveSchema = z.object({
  host: z.string().trim().min(1).max(255),
  port: z.coerce.number().int().min(1).max(65535),
  username: z.string().trim().min(1).max(255),
  password: z.string().max(500).optional(),
  encryptionMode: z.enum(['TLS', 'STARTTLS']),
  fromName: z.string().trim().min(1).max(120),
  fromEmail: z.string().email(),
  replyTo: z.string().email().optional().or(z.literal('')),
  enabled: z.enum(['on']).optional(),
});

export async function loader({request}: {request: Request}) {
  await requirePlatformAdmin(request);
  const row = await db.smtpConfiguration.findUnique({where: {id: 'platform'}});
  return {smtp: publicSmtpConfiguration(row), encryptionConfigured: Boolean(config.EMAIL_CONFIG_ENCRYPTION_KEY)};
}

export async function action({request}: {request: Request}) {
  const session = await requirePlatformAdmin(request);
  const form = await request.formData();
  assertCsrf(session.csrfToken, form.get('csrfToken'));
  if (!config.EMAIL_CONFIG_ENCRYPTION_KEY) return {error: 'Email configuration encryption is not configured.'};
  const intent = String(form.get('intent') ?? 'save');
  const parsed = saveSchema.safeParse({
    host: form.get('host'),
    port: form.get('port'),
    username: form.get('username'),
    password: form.get('password') || undefined,
    encryptionMode: form.get('encryptionMode'),
    fromName: form.get('fromName'),
    fromEmail: form.get('fromEmail'),
    replyTo: form.get('replyTo') || '',
    enabled: form.get('enabled') || undefined,
  });
  if (!parsed.success) return {error: 'Check the SMTP settings and try again.'};
  const existing = await db.smtpConfiguration.findUnique({where: {id: 'platform'}});
  const password = parsed.data.password
    ? encryptSecret(parsed.data.password, config.EMAIL_CONFIG_ENCRYPTION_KEY)
    : existing?.encryptedPassword;
  if (!password) return {error: 'Enter an SMTP password before saving.'};
  const saved = await db.smtpConfiguration.upsert({
    where: {id: 'platform'},
    create: {
      id: 'platform',
      host: parsed.data.host,
      port: parsed.data.port,
      username: parsed.data.username,
      encryptedPassword: password,
      encryptionMode: parsed.data.encryptionMode,
      fromName: parsed.data.fromName,
      fromEmail: parsed.data.fromEmail,
      replyTo: parsed.data.replyTo || null,
      enabled: parsed.data.enabled === 'on',
    },
    update: {
      host: parsed.data.host,
      port: parsed.data.port,
      username: parsed.data.username,
      encryptedPassword: password,
      encryptionMode: parsed.data.encryptionMode,
      fromName: parsed.data.fromName,
      fromEmail: parsed.data.fromEmail,
      replyTo: parsed.data.replyTo || null,
      enabled: parsed.data.enabled === 'on',
    },
  });
  const connection = {
    host: saved.host,
    port: saved.port,
    encryptionMode: saved.encryptionMode as 'TLS' | 'STARTTLS',
    username: saved.username,
    password: decryptSecret(saved.encryptedPassword, config.EMAIL_CONFIG_ENCRYPTION_KEY),
    fromName: saved.fromName,
    fromEmail: saved.fromEmail,
    replyTo: saved.replyTo,
  };
  const transport = new NodemailerSmtpTransport();
  if (intent === 'test' || intent === 'send-test') {
    try {
      await transport.verify(connection);
      await db.smtpConfiguration.update({where: {id: 'platform'}, data: {lastTestedAt: new Date(), lastTestStatus: 'success', lastTestError: null}});
      await writePlatformAudit({adminId: session.adminId, action: 'SMTP_TEST', metadata: {host: saved.host, result: 'success'}});
      if (intent === 'test') return {message: 'SMTP connection successful.'};
    } catch (error) {
      const safeError = sanitizeSmtpError(error, [connection.password, connection.username]);
      await db.smtpConfiguration.update({where: {id: 'platform'}, data: {lastTestedAt: new Date(), lastTestStatus: 'failed', lastTestError: safeError}});
      await writePlatformAudit({adminId: session.adminId, action: 'SMTP_TEST', metadata: {host: saved.host, result: 'failed'}});
      return {error: 'SMTP authentication failed.'};
    }
  }
  if (intent === 'send-test') {
    const recipient = z.string().email().safeParse(form.get('testRecipient'));
    if (!recipient.success) return {error: 'Enter a valid test recipient.'};
    try {
      const result = await transport.send(connection, {
        to: recipient.data,
        subject: 'Shopify Review SMTP test',
        html: '<p>This is a Shopify Review SMTP test.</p>',
        text: 'This is a Shopify Review SMTP test.',
      });
      await db.emailDelivery.create({
        data: {
          templateType: 'SMTP_TEST',
          recipientHash: hashEmail(recipient.data),
          recipientMasked: maskEmail(recipient.data),
          status: 'ACCEPTED',
          acceptedAt: new Date(),
          providerResponse: sanitizeSmtpError(result.response, [connection.password]).slice(0, 180),
        },
      });
      await writePlatformAudit({adminId: session.adminId, action: 'SMTP_TEST_EMAIL', metadata: {recipient: maskEmail(recipient.data), result: 'accepted'}});
      return {message: 'Accepted'};
    } catch (error) {
      const safeError = sanitizeSmtpError(error, [connection.password, connection.username]);
      await db.emailDelivery.create({
        data: {
          templateType: 'SMTP_TEST',
          recipientHash: hashEmail(recipient.data),
          recipientMasked: maskEmail(recipient.data),
          status: 'FAILED',
          failureReason: safeError,
        },
      });
      await writePlatformAudit({adminId: session.adminId, action: 'SMTP_TEST_EMAIL', metadata: {recipient: maskEmail(recipient.data), result: 'failed'}});
      return {error: 'Failed'};
    }
  }
  await writePlatformAudit({adminId: session.adminId, action: existing ? 'SMTP_UPDATED' : 'SMTP_CREATED', metadata: {host: saved.host, enabled: saved.enabled}});
  return {message: 'SMTP settings saved.'};
}

export default function SmtpSettings() {
  const {smtp, encryptionConfigured} = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const {csrfToken} = useOutletContext<{csrfToken: string}>();
  return (
    <section>
      <h1>SMTP</h1>
      {encryptionConfigured ? null : <p role="alert">Set EMAIL_CONFIG_ENCRYPTION_KEY before saving SMTP credentials.</p>}
      {result && 'message' in result ? <p role="status">{result.message}</p> : null}
      {result && 'error' in result ? <p role="alert">{result.error}</p> : null}
      <Form method="post">
        <input type="hidden" name="csrfToken" value={csrfToken} />
        <label>SMTP host<br /><input name="host" defaultValue={smtp?.host ?? ''} required /></label>
        <label>SMTP port<br /><input name="port" type="number" defaultValue={smtp?.port ?? 587} required /></label>
        <label>Username<br /><input name="username" defaultValue={smtp?.username ?? ''} autoComplete="off" required /></label>
        <label>Password<br /><input name="password" type="password" placeholder={smtp?.passwordConfigured ? '---' : ''} autoComplete="new-password" /></label>
        <label>Encryption<br />
          <select name="encryptionMode" defaultValue={smtp?.encryptionMode ?? 'STARTTLS'}>
            <option value="STARTTLS">STARTTLS</option>
            <option value="TLS">SSL/TLS</option>
          </select>
        </label>
        <label>From name<br /><input name="fromName" defaultValue={smtp?.fromName ?? ''} required /></label>
        <label>From email<br /><input name="fromEmail" type="email" defaultValue={smtp?.fromEmail ?? ''} required /></label>
        <label>Reply-to<br /><input name="replyTo" type="email" defaultValue={smtp?.replyTo ?? ''} /></label>
        <label><input name="enabled" type="checkbox" defaultChecked={smtp?.enabled ?? false} /> Enabled</label>
        <div>
          <button type="submit" name="intent" value="save">Save</button>
          <button type="submit" name="intent" value="test">Test connection</button>
        </div>
        <label>Test recipient<br /><input name="testRecipient" type="email" /></label>
        <button type="submit" name="intent" value="send-test">Send test email</button>
      </Form>
      <p>Last test: {smtp?.lastTestStatus ?? 'not tested'} {smtp?.lastTestError ?? ''}</p>
    </section>
  );
}
