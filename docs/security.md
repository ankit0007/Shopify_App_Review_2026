# Security

- Secrets are server-only and supplied by the deployment environment.
- Admin requests use Shopify token exchange/session authentication.
- Webhooks verify `X-Shopify-Hmac-Sha256` against the raw request body and use an event-id uniqueness constraint.
- All persistence queries are tenant-scoped.
- Public APIs return approved content only and use bounded pagination.
- Public App Proxy APIs verify Shopify's signed query parameters before resolving tenant data.
- Public review and storefront endpoints use bounded process-local rate limits; a distributed limiter is required before multi-instance scaling.
- Review links use cryptographically random, hashed, expiring tokens.
- Review-request tokens and customer email addresses are encrypted at rest for
  later delivery; one-way hashes are used where plaintext is not required.
- Uploads use MIME/content allowlists and magic-byte checks before storage.
  Dimension/duration inspection, malware scanning, private tenant keys, and
  provider-generated signed URLs remain required for production.
- Review form mutations reject cross-origin `Origin` headers.
- Merchant HTML must be sanitized before email rendering.
- Use TLS, secure cookies, CSRF protections for cookie-authenticated mutations, rate limiting, security headers, structured redacted logs, audit logs, and dependency scanning in deployment.

The release gate must include cross-tenant, token-abuse, XSS, SQL injection, upload-abuse, HMAC, App Proxy signature, CSRF, and rate-limit tests.

The process-local limiter is intentionally dependency-free and suitable for a single app process. It is not sufficient for multiple replicas or a multi-process worker fleet without a shared limiter.

`npm audit --omit=dev` currently reports four high-severity findings through Prisma's `@prisma/config` -> `deepmerge-ts` chain. The available automated remediation is a breaking Prisma/session-storage downgrade, so it was not applied. Revisit this when a compatible Prisma/security release is available; do not use `npm audit fix --force`.

The local HTTP email and object-storage adapters are provider-neutral
boundaries. They fail closed when configuration is absent and do not report a
message or upload as successful unless the provider accepts it.
