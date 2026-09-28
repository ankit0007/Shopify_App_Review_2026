# Shopify Review

Configurable, multi-tenant Shopify public app for collecting and moderating product reviews and customer UGC.

## Status

This repository is a production-oriented foundation and vertical slice. Shopify Partner Dashboard configuration, PostgreSQL, object storage, email delivery, Redis/queue infrastructure, HTTPS hosting, and a development store are required before production use. The app deliberately reports external services as unconfigured rather than pretending they are connected.

## Stack

- TypeScript, Node.js 22+, React Router, Polaris, App Bridge
- PostgreSQL and Prisma
- Shopify managed installation/token exchange and GraphQL Admin API
- Shopify App Pricing for new public-app plans
- Theme App Extension for storefront widgets

## Local setup

1. Install Node.js 22+ and Shopify CLI.
2. Copy `.env.example` to `.env` and set development credentials.
3. Run `npm install`.
4. Run `npm run db:generate` and apply migrations with `npm run db:migrate`.
5. Link/deploy the app configuration with `shopify app config link` and `shopify app deploy`.
6. Start development with `npm run dev`.

For production, use `docker-compose.production.yml`; do not copy production secrets into Git. The compose project publishes only `127.0.0.1:3500` and keeps PostgreSQL on a private network.

Do not commit `.env`, credentials, access tokens, or customer exports.

## Commands

`npm run typecheck`, `npm test`, `npm run lint`, `npm run build`, `npm run worker`, and `npm run db:deploy`.

## Architecture and operations

See [`docs/architecture.md`](docs/architecture.md), [`docs/database.md`](docs/database.md), [`docs/api.md`](docs/api.md), [`docs/security.md`](docs/security.md), [`docs/billing.md`](docs/billing.md), [`docs/deployment.md`](docs/deployment.md), [`docs/admin-panel.md`](docs/admin-panel.md), [`docs/smtp-configuration.md`](docs/smtp-configuration.md), and [`docs/shopify-app-store.md`](docs/shopify-app-store.md).

## Important limitations before launch

- Configure real Partner API credentials and Shopify App Pricing plans.
- Implement a production object-storage adapter, email provider adapter, durable queue, media processing, and monitoring.
- Exercise OAuth/token exchange, webhooks, GDPR redaction, billing, and storefront extension behavior against a Shopify development store.
- Set a real production privacy policy, terms of service, support contact, retention schedule, and App Store listing assets.
