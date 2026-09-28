# Platform administration panel

The operations panel at `/admin` is for the platform operator. It is separate from the Shopify embedded merchant admin at `/app`.

## Routes

| Path | Purpose |
| --- | --- |
| `/admin/login` | Administrator login |
| `/admin` and `/admin/dashboard` | Shop, review, and email counts |
| `/admin/smtp` | Global SMTP settings, connection test, and test email |
| `/admin/email-templates` | Platform email templates and preview |
| `/admin/email-logs` | Delivery log with masked recipients |
| `/admin/system` | Database, encryption-key, and storage status |
| `/admin/audit-log` | Administrator actions |

## Authentication

Platform administrators are stored in `PlatformAdmin`. Passwords are hashed with scrypt and are never stored in plaintext.

Create or rotate an administrator from the server environment, without printing the password:

```bash
PLATFORM_ADMIN_EMAIL=ops@example.com PLATFORM_ADMIN_PASSWORD='a-long-random-password' npm run admin:create
```

Remove `PLATFORM_ADMIN_PASSWORD` from the environment after the command succeeds. Do not commit it.

Sessions use an HTTP-only `platform_admin` cookie, `SameSite=Lax`, a 12-hour expiry, and a signed value. The database stores only a SHA-256 hash of the session token plus a CSRF token. Logout deletes that session. Login is limited to 5 attempts per 15 minutes for each client key. Failed and successful logins are written to the platform audit log.

Shopify merchant sessions are not accepted on these routes.

## Dashboard data

The dashboard shows aggregate counts only: installed shops, active shops, review totals by status, review requests, and accepted or failed email deliveries. It does not list customer names, email addresses, or review text.

## Security model

- Mutations require the session CSRF token.
- SMTP passwords are encrypted before they are written and are not returned to the browser.
- Audit metadata drops fields whose names contain password, secret, token, or credential.
- Template preview renders in a sandboxed iframe and escapes variable values.
- Templates only substitute the documented variables. Unknown placeholders are removed, and script tags are stripped before save.

The login rate limit is process-local. A multi-instance deployment still needs a shared limiter before it can be treated as a distributed control.
