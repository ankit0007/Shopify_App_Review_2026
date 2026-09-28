# SMTP configuration

Shopify Review uses one global platform SMTP configuration. Merchants cannot enter SMTP credentials. Object storage stays independent of email.

## Architecture

Review requests call `EmailService`. When the platform SMTP row is enabled, `SMTPEmailProvider` sends through an `SmtpTransport`. Nodemailer is used only inside that transport. The review worker does not import it.

Supported encryption modes are SSL/TLS and STARTTLS. Plain SMTP is rejected unless `SMTP_ALLOW_INSECURE=true` is set deliberately. The default is false.

## Stored fields

`SmtpConfiguration` keeps one row with id `platform`: host, port, username, encrypted password, encryption mode, from name, from email, reply-to, enabled, and the last connection-test result. The password column contains AES-256-GCM ciphertext. The key is `EMAIL_CONFIG_ENCRYPTION_KEY` and is never stored in the database.

Public responses include `passwordConfigured`. They do not include the password or the ciphertext. The settings form shows `---` when a password already exists.

## Environment variables

```bash
EMAIL_CONFIG_ENCRYPTION_KEY=replace-with-a-long-random-string
SMTP_MAX_RETRIES=3
SMTP_ALLOW_INSECURE=false
```

Generate the encryption key on the server and keep it only in the server environment. Losing the key makes the stored password unreadable. Do not commit a real key.

## Test procedure

1. Save the host, port, username, password, encryption mode, and sender addresses.
2. Use **Test connection**. The server checks DNS, TCP, TLS, and authentication. The page reports success or a generic failure, and stores only a sanitized error.
3. Enter a recipient and use **Send test email**. The result is Accepted or Failed. The log stores a masked recipient and a recipient hash, not the message body.

Automated tests mock the transport and do not send real email.

## Templates

Initial templates are `REVIEW_REQUEST`, `REVIEW_REMINDER_1`, `REVIEW_REMINDER_2`, `REVIEW_RECEIVED`, `REVIEW_APPROVED`, and `REVIEW_REJECTED`.

Variables: `{{shopName}}`, `{{customerName}}`, `{{productName}}`, `{{reviewUrl}}`, `{{unsubscribeUrl}}`.

HTML values are escaped. The template source is not executed as code.

## Email statuses

`QUEUED`, `PROCESSING`, `ACCEPTED`, `FAILED`, `RETRYING`, and `EXPIRED`.

`ACCEPTED` means the SMTP server accepted the message. A connection attempt that throws is not marked accepted. Transient failures use exponential backoff, starting at 5 minutes and capped at 1 hour, up to `SMTP_MAX_RETRIES`. Authentication and invalid-recipient failures are not retried. An accepted delivery for the same request and template is not sent again.

The worker also skips uninstalled shops, customers who opted out, customers who already reviewed the product, expired requests, and requests missing a shop, order, product, recipient, or token.

## Production configuration procedure

Do this only after production access is explicitly authorized. Do not copy SMTP passwords from another application's environment file into Git, logs, or this repository.

1. Inspect the existing VPS mail service read-only. Identify whether it is Postfix, Exim, Docker Mailserver, or another service.
2. Record only the hostname, port, TLS mode, and sender domain. Do not print or copy the password into a terminal transcript, ticket, or file that is committed.
3. Set `EMAIL_CONFIG_ENCRYPTION_KEY` in the Shopify Review server environment.
4. Create the platform administrator with `npm run admin:create`, then remove the password from the environment.
5. Open `/admin/smtp` on the application host and enter the mail settings there. Confirm with **Test connection** and **Send test email**.
6. Leave `SMTP_ALLOW_INSECURE` unset or `false` unless the mail service has no TLS and that exception is explicitly approved.

This repository does not contain production SMTP credentials, and this procedure does not change Nginx, Docker, or other applications.
