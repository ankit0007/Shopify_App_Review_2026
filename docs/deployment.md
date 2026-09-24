# Deployment

Deploy the web process and worker as separate supervised processes behind HTTPS. Use managed PostgreSQL, private object storage, Redis-compatible queue infrastructure, centralized redacted logs, error monitoring, backups, and health checks.

Required production environment values are documented in `.env.example`. Rotate secrets through the hosting provider, not Git. Run `npm run db:deploy` during a controlled release before starting the new app version.

Verify `/health`, Shopify callback URLs, webhook delivery, background job execution, signed media URLs, secure cookies, and graceful shutdown in staging before production.
