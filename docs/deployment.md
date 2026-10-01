# Deployment

The production artifact is `docker-compose.production.yml`. It creates only `shopifyreview-app` and `shopifyreview-db` on `shopifyreview-network`; PostgreSQL has no published host port and the app is published only on `127.0.0.1:3500`.

Docker Compose syntax must be validated on a host with Docker installed; Docker is not installed in the current Windows development environment, so no container build was attempted locally.

Before deployment:

1. Create a server-only `.env.production` from `.env.example`.
2. Set `POSTGRES_PASSWORD`, `POSTGRES_DB`, and `POSTGRES_USER` in the compose environment.
3. Configure real Shopify, Partner API, object-storage, and email values.
4. Review `prisma/migrations/0001_init/migration.sql`.

Start the isolated project with:

```bash
docker compose -p shopifyreview -f docker-compose.production.yml up -d --build
```

The app container runs `prisma migrate deploy` before starting. This command must only be run against the dedicated `shopify_review_db` container.

Deploy the web process behind the existing Nginx only after confirming that port 3500 is unused. The dedicated server block must use `server_name productreviews.it3.in` and proxy to `http://127.0.0.1:3500`.

Required production environment values are documented in `.env.example`. Rotate secrets through the hosting provider, not Git. For a non-container database, run `npm run db:deploy` during a controlled release before starting the new app version.

Verify `/health`, Shopify callback URLs, webhook delivery, background job execution, signed media URLs, secure cookies, and graceful shutdown in staging before production.
