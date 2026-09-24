# Security

- Secrets are server-only and supplied by the deployment environment.
- Admin requests use Shopify token exchange/session authentication.
- Webhooks verify `X-Shopify-Hmac-Sha256` against the raw request body and use an event-id uniqueness constraint.
- All persistence queries are tenant-scoped.
- Public APIs return approved content only and use bounded pagination.
- Review links use cryptographically random, hashed, expiring tokens.
- Uploads must use MIME/content allowlists, size/dimension/duration limits, private tenant keys, and signed URLs.
- Merchant HTML must be sanitized before email rendering.
- Use TLS, secure cookies, CSRF protections for cookie-authenticated mutations, rate limiting, security headers, structured redacted logs, audit logs, and dependency scanning in deployment.

The release gate must include cross-tenant, token-abuse, XSS, SQL injection, upload-abuse, HMAC, and rate-limit tests.
