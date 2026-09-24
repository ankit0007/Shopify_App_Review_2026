# API

Responses use `{success: true, data}` or `{success: false, error: {code, message}}`.

Groups:

- `/app/*`: embedded admin routes; protected by Shopify authentication.
- `/api/public/*`: storefront-safe, approved-review data only; paginated and cacheable.
- `/review/:token`: expiring customer submission flow; token is hashed server-side.
- `/webhooks`: raw-body HMAC verification, idempotent persistence, fast acknowledgement.
- `/health`: non-sensitive application/database health.

Never expose Shopify access tokens, customer email/address, moderation notes, or raw internal metadata.
