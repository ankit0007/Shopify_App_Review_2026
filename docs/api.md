# API

Responses use `{success: true, data}` or `{success: false, error: {code, message}}`.

Groups:

- `/app/*`: embedded admin routes; protected by Shopify authentication.
- `/api/public/*`: storefront-safe, approved-review data only; paginated and cacheable.
- `/review/:token`: expiring customer submission flow; token is hashed server-side.
- `/webhooks`: raw-body HMAC verification, idempotent persistence, fast acknowledgement.
- `/health`: non-sensitive application/database health.

The public review endpoint requires Shopify App Proxy `shop` and `signature`
parameters. It returns only approved reviews and aggregate rating metadata.
The cursor is opaque to clients and invalid cursors are rejected.

CSV import/export is an authenticated merchant capability implemented behind
the import/export service boundary. Imported reviews always start as pending
and unverified; a CSV flag cannot create a verified-purchase claim. A route and
UI must be added before exposing this capability to merchants.

Review-request emails are provider-backed. A disabled or rejected provider
leaves the request failed and records an email event; it is never reported as
sent.

Never expose Shopify access tokens, customer email/address, moderation notes, or raw internal metadata.
