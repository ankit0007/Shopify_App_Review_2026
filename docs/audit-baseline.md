# Repository audit baseline

This baseline was produced before the foundation hardening work. It records
what is implemented locally and what still requires code or external Shopify
configuration. It does not represent a production deployment or App Store
approval.

## Implemented

- Embedded Shopify public-app authentication and Prisma session persistence.
- Tenant-scoped review moderation and approved-review App Proxy reads.
- Hashed review tokens, webhook HMAC checks, basic CSRF, rate limiting, and
  server-side review validation.
- Prisma migrations, a non-root Docker runtime, private PostgreSQL networking,
  and a Theme App Extension.

## Partial

- Review requests have a token route and status model, but no durable scheduler,
  fulfillment-triggered creation, reminder processor, or real email delivery.
- Purchase verification only checks locally synchronized order items.
- Media has metadata validation and interfaces, but no upload, object storage,
  processing, signed delivery, or cleanup flow.
- Billing and usage models exist, but subscription actions and limit enforcement
  are not wired into every mutation.
- Admin moderation, storefront widgets, analytics, privacy processing, and
  commerce synchronization are narrow vertical slices.

## Required before App Store submission

- Register and verify required Shopify compliance subscriptions in the Partner
  Dashboard and test raw-body HMAC handling.
- Configure and verify Shopify App Pricing, privacy policy, support contact,
  retention rules, listing assets, and minimum scopes.
- Configure an email provider and object storage, or keep those capabilities
  visibly disabled.
- Complete development-store tests for install, uninstall, webhooks, review
  requests, moderation, storefront rendering, billing, privacy, and media.

## Repository quality gates

CI uses Node 22, applies Prisma migrations with `prisma migrate deploy`, and
then runs typecheck, tests, lint, and the production build. Local verification
must also run `prisma validate`, `prisma generate`, and Shopify extension
validation. Production services are outside this audit and must not be changed
by local implementation work.
