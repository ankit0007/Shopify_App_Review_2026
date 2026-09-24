# Architecture

The app is a tenant-aware modular monolith. Shopify admin routes authenticate with the official React Router package; customer review pages and storefront APIs expose only scoped public DTOs. Domain services own business rules, Prisma owns persistence, and workers handle scheduled or expensive work.

Every merchant-owned record has `shopId`. Server code derives that value from an authenticated Shopify session or a hashed, scoped customer token. Browser-supplied tenant IDs are never authorization inputs.

The durable production topology is:

`Shopify Admin/Storefront -> HTTPS app -> domain services -> PostgreSQL`

with object storage, email, and a Redis-compatible job queue attached to the domain layer.
