# Database

`prisma/schema.prisma` defines the tenant-rooted PostgreSQL schema. Shops are the tenant root; sessions, settings, customers, commerce references, review requests, reviews, media metadata, events, subscriptions, usage, analytics, consent, and audit logs cascade from the shop where deletion is appropriate.

The initial reviewed migration is `prisma/migrations/0001_init/migration.sql`. Run `npm run db:generate` after schema changes. Use `npm run db:migrate` locally and `npm run db:deploy` in staging/production. Never use `db push` as a production migration strategy. The production compose command runs `prisma migrate deploy` against its private PostgreSQL service.

Review content is separate from verification evidence and moderation status. Binary media is not stored in PostgreSQL.
