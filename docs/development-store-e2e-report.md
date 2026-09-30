# Development store end-to-end report

Date: 2026-09-29

Store tested: `sftp-7qtjiorq.myshopify.com` (sftp)

Installed app: Product Reviews

Production VPS, Nginx, Docker, production database, and unrelated apps were not modified. No new review, order, fulfillment, webhook delivery, billing charge, or theme edit was created. Read-only requests were sent to the already installed app and storefront.

The test browser was not logged into Shopify Admin. Admin and Theme Editor checks stopped at the Shopify login wall.

## Results

| Feature | Status | Evidence | Problem | Required Fix |
| --- | --- | --- | --- | --- |
| Embedded admin installation | NOT TESTED | Opening the admin app redirected to Shopify login. Captcha reported that it could not load. | Admin session, App Bridge, and navigation were not exercised. | Sign in with the development-store staff account in a normal browser and repeat Dashboard through Plan & Usage. |
| Existing admin routes without a session | PARTIAL | Direct requests to `/app`, `/app/reviews`, `/app/settings`, and `/app/plan-usage` returned HTTP 410. No 500 or stack trace was returned. | This only proves unauthenticated handling, not a working embedded session. | Retest inside Shopify Admin. |
| Review Requests admin page | FAIL | `/app/requests` returned HTTP 404 on the installed app. | The local route exists, but the installed app does not serve it. | Deploy the local app only when production deployment is explicitly approved. |
| UGC/Media, Widgets, Email, Analytics, Import/Export, Integrations pages | NOT TESTED | No matching admin routes exist in `app/routes.ts`. | Those screens were not implemented. | Add the missing tenant-scoped admin screens before claiming the full navigation. |
| Shop synchronization | NOT TESTED | `shopify store execute` reported no stored app authentication for this store. | Shop GID, settings, and subscription state were not read. | Run non-production store authentication with read scopes, then query shop identity. |
| Product synchronization | PARTIAL | Storefront product pages showed Shopify product titles and prices. Review API calls resolved product `10746305609893` and `10746305020069`. | No product update or client-title overwrite test was run, because that would write to the installed app database. | Sync products through Admin GraphQL and confirm the stored title comes only from Shopify. |
| Review submission | PARTIAL | An existing approved review was returned and rendered. An empty submission returned HTTP 400 `INVALID_REVIEW`. A 6,000-character body returned the same safe error. The review list was unchanged afterward. | A new review was not submitted, so duplicate prevention and successful creation were not tested in this run. | Submit one development review only after deciding that writing to the installed app database is allowed. |
| Review-request token | PARTIAL | `/review/not-a-real-token` returned HTTP 410 without a stack trace. | Expired, reused, cross-shop, and cross-product tokens were not tested. | Create isolated development requests and test each negative case. |
| Photo upload | NOT CONFIGURED | The live review form has no file input. Local `.env.example` has empty storage settings. | No valid or invalid upload could be accepted safely. | Configure private object storage, then test JPEG/PNG/WebP, MIME mismatch, oversize, and fake extensions. |
| Video upload | NOT CONFIGURED | No video input, storage provider, thumbnail generator, or playback element was available. | Video behavior was not exercised. | Add duration inspection, private storage, thumbnails, and lazy playback after storage is configured. |
| Admin moderation | NOT TESTED | Admin login was unavailable. | Approve, reject, hide, delete, feature, filters, search, pagination, and audit logs were not clicked. | Retest in Shopify Admin. Confirm rejected reviews stay off the storefront. |
| Storefront stars and review list | PASS | On The Collection Snowboard: Liquid, the installed `product-reviews-4` widget showed four golden stars and one empty star, `4.0 out of 5 · 1 review`, the reviewer name, and the review text. | The same content was rendered twice because two review blocks are active. | Keep one product-page block and one optional embed, not both with the same content. |
| Storefront extension version | PARTIAL | Liquid loaded `product-reviews-4` star buttons. The earlier Hydrogen page load still served `product-reviews-2`, which showed a rating dropdown. | Storefront assets are cached across extension versions. | Reload affected pages after extension release and confirm every product uses the current version. |
| Rejected review privacy | PASS | The public list for product `10746305020069` returned two approved reviews and did not include the known rejected review text. | Only this deployed dataset was checked. | Add an automated fixture for rejected, hidden, and deleted reviews. |
| Verified badge, date, title, media | PARTIAL | The API returned `verifiedPurchase: false`, `submittedAt`, `title: null`, and `media: []`. The deployed widget rendered name and body only. | Verified state, date, title, and media are not shown. | Render the returned fields and add storefront pagination. |
| Pagination and sorting | PARTIAL | `limit=1` returned one review and a cursor. The widget always requests `limit=10` and has no sorting controls. | An invalid cursor returned HTTP 200 with an empty list instead of a client error. The cursor is an encoded internal review id. | Reject malformed cursors, use an opaque non-database cursor, and add widget pagination. |
| Theme Editor | NOT TESTED | Theme Editor requires Shopify Admin login. | Settings save/load and editor errors were not observed. | Open the live `test-data` theme editor after staff login. |
| Theme extension rendering | PASS | Live theme `test-data` (`158207312037`) rendered the review extension on product pages. No Liquid or JavaScript error was visible in the rendered widget. | Two copies of the widget appear. | Remove the duplicate block in the theme editor; do not edit theme files directly. |
| Mobile layout | PARTIAL | A 390px emulation showed the review card, stars, text, and form without overlap. | The page retained a wide empty area and did not demonstrate a true device browser. | Repeat on a real phone or browser device mode after a normal viewport reload. |
| Verified purchase | NOT TESTED | Existing public reviews have `verifiedPurchase: false`. No development order was created. | Shop, customer, order, line item, and product verification was not proven. | Create one development order and one mismatched-product control, then verify the stored reason. |
| Review-request automation | NOT TESTED | No fulfillment or request was created. | Delay, product, customer, status, and duplicate protection were not observed. | Configure a safe recipient and run one fulfillment through the worker. |
| Reminders and unsubscribe | NOT TESTED | No request was scheduled. | Reminder count, expiry, unsubscribe, and already-reviewed behavior were not observed. | Test with one request and one reminder, not a bulk send. |
| Email provider | NOT CONFIGURED | Local configuration defaults to `EMAIL_PROVIDER=disabled`. No provider acceptance was observed. | The test did not claim an email was sent. | Configure a real provider and confirm failed delivery stays `FAILED`. |
| App Proxy signature | PASS | A storefront-signed request returned HTTP 200. A direct unsigned request returned HTTP 401 `INVALID_SIGNATURE`. An invalid shop returned HTTP 400 `INVALID_SHOP`. | Adding a parameter through the storefront is re-signed by Shopify, so it does not prove rejection of tampering. | Keep direct signature tests in CI, including duplicate and ordering cases. |
| Rate limiting | NOT TESTED | Live limits were not exhausted, to avoid blocking the storefront. Unit tests cover the in-memory limiter. | Production behavior across processes remains unproven. | Add a distributed limiter and test it in an isolated environment. |
| Billing | NOT CONFIGURED | No Admin billing screen was opened. Plan prices in `.env.example` are empty. No charge was created. | Paid plans cannot be shown as active or purchased. | Configure Shopify App Pricing in the Partner Dashboard and verify the free plan without creating a charge. |
| GDPR webhooks | PARTIAL | An invalid HMAC POST to `/webhooks` returned HTTP 401. `shopify.app.toml` registers only `app/uninstalled`. | Customer data request, customer redact, and shop redact were not delivered or processed. | Register the required compliance topics in the Partner Dashboard and test them with disposable development data. |
| Security exposure | PARTIAL | Review JSON contained rating, title, body, display name, verification flag, date, and media type metadata. It did not contain tokens, secrets, email, or storage keys. | The pagination cursor exposes an encoded internal id. Admin IDOR and CSRF were not tested. | Replace the cursor and repeat cross-shop authorization tests. |
| Error states | PARTIAL | Invalid review, invalid shop, invalid signature, and invalid token returned safe HTTP errors without stack traces. | Database, email, and storage failures were not simulated. | Add isolated failure tests for each provider. |
| Performance | PARTIAL | Signed review reads took about 0.5s and 2.2s. The widget loads after page render and limits the request to 10 reviews. | Two widgets make duplicate requests. Query plans were not measured. | Deduplicate requests and measure database queries with production-like data. |
| Automated regression | PASS | `npm test` passed 18 tests. Typecheck, lint, build, Prisma validate, Prisma generate, and `shopify app build` passed. | `prisma migrate status` was not run because no local database was running. Docker was not available locally. | Apply migrations to an isolated empty database before deployment. |

## Detailed results

### 1. Installation

Not tested. The admin app URL redirected to Shopify login, and the login page reported that captcha could not load.

### 2. Admin

Not tested inside the embedded app. Unauthenticated requests to the installed Dashboard, Reviews, Settings, and Plan & Usage routes returned HTTP 410. Review Requests returned HTTP 404 on the installed app. UGC/Media, Widgets, Email, Analytics, Import/Export, and Integrations routes are absent.

### 3. Review submission

Partially tested. Existing approved review data was read successfully. Empty and oversized submissions were rejected with `INVALID_REVIEW` and did not add a review. A new successful submission and duplicate-submission test were intentionally not run.

### 4. Moderation

Not tested. The admin session was unavailable.

### 5. Theme extension

The storefront proves the extension renders. Theme Editor settings were not tested because admin login was unavailable. The live theme remains `test-data`.

### 6. Storefront

The Liquid product page rendered golden star ratings, the review count, the approved review, and the submission form. The rejected review was absent from the other product's public response. The widget is duplicated, does not paginate, and does not show the verification flag or date.

### 7. Verified purchase

Not tested. No development order was created. Existing public reviews are not marked as verified purchases.

### 8. Photo

Not configured. The live form cannot upload a file, and object storage credentials are not configured.

### 9. Video

Not configured. Video processing and playback are not available.

### 10. Review request

Not tested. No fulfillment or request was created.

### 11. Email

Not configured. No email was sent or reported as sent.

### 12. App Proxy

Valid signed reads, missing signatures, and invalid shops behaved correctly. Pagination returned a cursor, but an invalid cursor returned an empty success response.

### 13. Billing

Not configured and not tested in Admin. No paid charge was created.

### 14. GDPR

Invalid webhook authentication was rejected. The required compliance subscriptions are not present in the app configuration, and no valid privacy webhook was delivered.

### 15. Security

Public review responses did not expose secrets or private storage data. The encoded review cursor is an internal identifier. Cross-shop admin access was not tested.

### 16. Performance

The storefront widget is non-blocking, but duplicate widgets caused duplicate work and one signed read took about two seconds. No database query trace was captured.

### 17. Automated tests

All requested local commands passed: installation, 18 tests, typecheck, lint, build, Prisma validation, Prisma generation, and Shopify app build.

### 18. Remaining blockers before App Store submission

- Repeat admin, Theme Editor, billing, moderation, and navigation tests in an authenticated development-store session.
- Deploy local changes only through an approved isolated release; the installed app does not include every local route.
- Register customers/data_request, customers/redact, and shop/redact, then test them with disposable data.
- Configure Shopify App Pricing without creating an unapproved charge.
- Configure a real email provider and private object storage, or keep those features visibly disabled.
- Prove verified purchase with one real development order and one mismatched product.
- Remove duplicate storefront widgets and stop exposing internal IDs in cursors.
- Add live rate-limit, IDOR, XSS, and privacy-processing tests.
- Resolve or formally accept the four high-severity Prisma dependency findings.
- Complete privacy policy, terms, support contact, retention policy, and listing assets.
- Apply and verify Prisma migrations against an isolated empty database.

No production deployment or App Store submission was performed.

## Local follow-up after the store test

This follow-up changed only the local repository. It was not deployed, and the development storefront still shows the previously released extension until an approved release.

### Root cause of the duplicate review section

The live theme enables both Theme App Extension placements:

- the product-template app block `review-summary` (`target = "section"`)
- the app embed `review-embed` (`target = "body"`)

Each placement rendered a complete review widget and loaded `review-widgets.js`, so the page fetched and displayed the same reviews twice. This was not a CSS duplicate and not a second API renderer.

The local extension now shares one snippet. The script keeps one widget per product and prefers the section block over the body embed. Extra nodes are removed before their requests run. An embed-only install still renders once. This was verified with unit tests, not on the live theme.

### Settings that are implemented

The block and embed settings that affect output are:

- star color
- reviews per page
- show review form
- show customer name
- show review date
- show verified purchase badge
- empty-state message
- submit button text

Photo display, video display, sorting, typography, and spacing are not settings because those behaviors are not implemented. Pagination is a real "Load more" control driven by the reviews-per-page setting.

### Local behavior added

- Public review submission rejects an identical review for the same shop, product, name, and body within 24 hours.
- Review cursors are encrypted with the app secret instead of exposing the database id.
- Verified purchase now requires the same shop, fulfilled order, customer, and product line. An order id alone is not enough. The valid and invalid relationships are covered by unit tests, not by a new development-store order.
- Image uploads that reach the media service check PNG or JPEG dimensions. Storage still fails closed when object storage is not configured. Thumbnails are not generated.
- Video uploads are not production-ready. Duration, poster frames, and playback are not implemented.
- Review requests are skipped for an uninstalled shop, an opted-out customer, or a customer who already reviewed that product. A request is marked accepted only after the email provider accepts it. The disabled provider still fails the request.
- Admin request rows can show delivery state, dates, reminder count, order number, and failure reason without the customer email. This route is still absent from the installed app.
- Dashboard analytics read real review, media, and request counts. Conversion is omitted when no accepted requests exist.
- Paid plans stay on Free unless Shopify reports an active subscription. Environment prices do not activate Pro.
- Admin loaders for Dashboard, Reviews, Review Requests, Settings, and Plan & Usage call Shopify `authenticate.admin`. A logged-in Admin session was not available, so this is code verification only.

### Theme Editor installation flow

1. In Shopify Admin, open Online Store, then Themes.
2. On the current theme, choose Customize.
3. Open the product template.
4. Add a block or section, choose Apps, then Customer reviews.
5. Optionally enable Customer reviews embed under App embeds. On a product page, the section block is kept and the embed is not mounted again.
6. Save the theme. Do not edit theme Liquid files.

### Tests performed

- `npm test`: 27 tests passed, including widget placement, purchase matching, encrypted cursors, delivery labels, plan activation, and image dimensions.
- `npm run typecheck`, `npm run lint`, and `npm run build` passed.
- `npx prisma validate` and `npx prisma generate` passed.
- `shopify app build` passed, including theme check.

### Tests not performed

- The updated widget was not rendered on the development store.
- Widths 320, 375, 390, and 414 were not retested against the new CSS.
- No new review, order, fulfillment, upload, email, billing charge, or privacy webhook was created.
- Shopify Admin and Theme Editor were not opened with a staff session.
- Database migration status was not checked because no local PostgreSQL server is running.

### Files changed in this follow-up

- `extensions/review-widgets/snippets/review-widget.liquid`
- `extensions/review-widgets/blocks/review-summary.liquid`
- `extensions/review-widgets/blocks/review-embed.liquid`
- `extensions/review-widgets/assets/review-widgets.js`
- `extensions/review-widgets/assets/review-widgets.css`
- `app/modules/reviews/widget-placement.ts`
- `app/modules/reviews/widget-placement.test.ts`
- `app/modules/reviews/purchase-match.ts`
- `app/modules/reviews/purchase-match.test.ts`
- `app/modules/reviews/verification.service.server.ts`
- `app/lib/shopify-signatures.server.ts`
- `app/lib/shopify-signatures.server.test.ts`
- `app/routes/api.public.products.$productId.reviews.ts`
- `app/routes/app._index.tsx`
- `app/routes/app.requests.tsx`
- `app/modules/analytics/analytics.service.server.ts`
- `app/modules/billing/billing.service.server.ts`
- `app/modules/plans/plans.ts`
- `app/modules/plans/plans.test.ts`
- `app/modules/email/delivery-state.ts`
- `app/modules/email/delivery-state.test.ts`
- `app/modules/media/media-validation.server.ts`
- `app/modules/media/media-validation.server.test.ts`
- `app/modules/media/media.service.server.ts`
- `app/modules/commerce/sync.service.server.ts`
- `app/worker.ts`

The storefront script is about 8 KB and the stylesheet is about 2.4 KB before CDN compression.

## Remaining blockers before Shopify App Store submission

### CRITICAL

- Release the local app and theme extension only through an approved deployment. The development store is still running the older duplicate widget.
- Register and test `customers/data_request`, `customers/redact`, and `shop/redact` with disposable data. Only `app/uninstalled` is configured.
- Complete a staff-authenticated Admin pass for Dashboard, Reviews, Review Requests, Settings, and Plan & Usage.
- Configure Shopify App Pricing for Free and Pro. Do not treat environment prices as an active subscription, and do not create a charge without approval.

### HIGH

- Configure a real email provider or keep requests visibly failed. No email was sent.
- Configure private object storage before enabling photo reviews. Required environment values are `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, and `STORAGE_PUBLIC_ENDPOINT`.
- Prove verified purchase with one real development order for the reviewed product and one mismatched product. Unit tests cover the relationship rules only.
- Add video duration limits, poster frames, and safe playback before offering video reviews.
- Add image thumbnail generation and orphan cleanup after storage is configured.
- Publish a privacy policy, terms, support contact, and retention policy.

### MEDIUM

- Retest the single-widget behavior, Load more control, and settings on desktop and at 320, 375, 390, and 414 CSS pixels after release.
- Confirm the new encrypted cursor and duplicate-review response on the installed app.
- Resolve or formally accept the four high-severity Prisma dependency findings.
- Apply migrations on an isolated empty database before deployment.

### LOW

- Add the remaining admin sections only when their features exist: UGC/Media, Widgets, Email, Analytics, Import/Export, and Integrations.
- Measure database query plans with production-like review volume.
- Replace the process-local rate limiter before running more than one app process.

No production deployment or App Store submission was performed.

## Platform Admin & SMTP E2E Test

Date: 2026-09-29

Local only. The app ran at `http://127.0.0.1:3000`. PostgreSQL was an embedded local server on `127.0.0.1:5432`, database `shopify_review_dev`. SMTP was a local STARTTLS mock on `127.0.0.1:2525`. No production host, Nginx, Docker, database, or SMTP service was contacted, and no production email was sent.

| Check | Status | Evidence |
| --- | --- | --- |
| Local database setup | PASS | `npx prisma migrate deploy` applied migrations `0001` through `0007_platform_smtp_admin`. Tables present: `PlatformAdmin`, `PlatformSession`, `SmtpConfiguration`, `PlatformEmailTemplate`, `EmailDelivery`, `PlatformAuditLog`. Six templates were seeded and enabled. |
| Admin login | PASS | Unauthenticated `/admin/dashboard` redirected to `/admin/login`. Valid login reached the dashboard. A wrong password returned “The email or password is incorrect.” Empty fields failed browser validation (`checkValidity()` was false) and an empty POST returned the same invalid-credentials message. After five attempts, the correct password returned “Too many login attempts. Try again later.” Logout from `/admin/email-logs` returned to `/admin/login` after the logout form was posted to `/admin`. The `platform_admin` cookie is `HttpOnly`, `SameSite=Lax`, `Path=/admin`, `Max-Age=43200`. `document.cookie` was empty while logged in. A session whose `expiresAt` was set in the past redirected to login. |
| Dashboard | PASS | Before fixture data, every count was 0. After local fixtures, the page showed 10 installed shops, 9 active shops, 1 review, 0 approved, 1 pending, 0 rejected, 12 review requests, 2 accepted emails, and 1 failed email. |
| SMTP settings | PASS | The page showed host, port, username, password, STARTTLS/TLS, from name, from email, reply-to, and enabled. Local mock values were saved. After reload the password field was empty and its placeholder was `---`. |
| SMTP security | PASS | Reloaded HTML did not contain the SMTP password. The database value has three ciphertext parts and does not contain the plaintext password. Audit metadata and the dev-server log did not contain the admin or SMTP passwords. |
| SMTP connection | PASS | The valid mock returned “SMTP connection successful.” A closed local port returned “SMTP authentication failed.” with no stack trace and no credential. |
| Test email | PASS | `tester@example.com` was recorded as `ACCEPTED` with recipient `t***@example.com`. `reject-me@example.com` was recorded as `FAILED` with a sanitized recipient rejection. Both wrote `SMTP_TEST_EMAIL` audit events. |
| Templates | PASS | All six seeded templates rendered with subject, HTML, text, and enabled checked. Preview of `REVIEW_REQUEST` substituted shop, customer, product, review URL, and unsubscribe URL. `Avery <Customer>` rendered as `Avery &lt;Customer&gt;` inside a sandboxed iframe. A saved `<script>alert(1)</script>` was removed from the stored HTML. The original approved template was restored. |
| Email logs | PARTIAL | The page showed `ACCEPTED`, `FAILED`, `RETRYING`, and `EXPIRED` with masked recipients and no password. `QUEUED` and `PROCESSING` were not visible because the worker moves those rows to a final status before the page is opened. |
| Audit log | PASS | The page and database included `ADMIN_LOGIN`, `ADMIN_LOGOUT`, `ADMIN_LOGIN_FAILED`, `SMTP_CREATED`, `SMTP_UPDATED`, `SMTP_TEST`, `SMTP_TEST_EMAIL`, and `EMAIL_TEMPLATE_UPDATED`. Metadata did not contain passwords. |
| System page | PASS | It showed database `ok`, SMTP encryption key `configured`, and object storage `not configured`. It did not show the encryption key, SMTP password, session secret, Shopify API secret, or database password. |
| Unsubscribe | PARTIAL | A valid token showed “Unsubscribed” and created a `review_request` opt-out. The next scheduled request for that customer was `CANCELLED`. An unknown token returned HTTP 410 and a generic support message. An expired token returned HTTP 200 and the same confirmation page; it was not rejected. |
| Worker | PASS | The eligible local request became `SENT` with one `ACCEPTED` delivery to `b***@example.com`. Running the worker again did not create a second accepted delivery. Already reviewed, opted out, uninstalled, and missing product requests became `CANCELLED`. The expired request and its queued delivery became `EXPIRED`. Missing recipient and invalid token became `FAILED`. With the mock stopped, a new request became `RETRYING` with retry count 1 and a later `scheduledAt`. |
| Security | PASS | Unauthenticated and invalid-session requests to admin pages returned HTTP 302 to login. A missing CSRF token and another session’s CSRF token returned HTTP 403. A malformed SMTP post returned “Check the SMTP settings and try again.” A password value containing a SQL statement stayed ciphertext and `SmtpConfiguration` was still readable afterward. |
| Regression | PASS | `npm test` (41), `npm run typecheck`, `npm run lint`, `npm run build`, `npx prisma validate`, `npx prisma generate`, and `shopify app build` passed. The first `prisma generate` in the same run failed with `EPERM` while the dev server had the query engine open; it passed after that process was stopped. |

Logout from a child admin route initially returned HTTP 405 because the form posted to the child route. The logout form now posts to `/admin`, and the retest reached the login page.

Production VPS `187.124.157.194` was not contacted. Production Nginx, Docker, databases, and SMTP were not modified. No production email was sent.

## Phase 1 submission pass

Date: 2026-09-29

Local code now declares the three mandatory compliance webhook topics in `shopify.app.toml` and returns HTTP 200 for those topics when the shop is already gone. The review-link form hides photo and video upload until object storage is configured, and a posted file is rejected before a review is saved. `deploy/nginx/shopifyreview.it3.in.conf` is prepared and was not installed. The submission checklist is `docs/app-store-submission-checklist.md`.

This build was not deployed and was not submitted. The development store still needs an authorized release before the single-widget extension, encrypted cursors, and compliance webhook subscription can be verified there.

## Product Rating & Listing E2E Test

Date: 2026-10-01

The rating summary was added locally on the current app. Production host `187.124.157.194`, production Nginx, Docker, the production database, and production email were not touched. The theme extension was not published. `shopify app deploy` and `shopify app dev` were not run, so the development store still has the previously published extension.

### Placement

Online Store 2.0 themes can place two independent app blocks:

- **Product rating** shows only the compact summary. In the theme editor, open the product template, add the Product rating block, and move it directly under the product title and above the price.
- **Product reviews** is the existing full list and form. Keep a single copy lower on the product template.

For collection and search pages, enable the **Product ratings** app embed. It emits one hidden summary per product from `collection.products` or from product results in `search.results`, then moves each summary after an `h1` whose text matches that product title, or into the parent of the first link whose href contains `/products/{handle}`. It does not use a Dawn-only class name. A summary that cannot be placed is removed, so it does not appear at the bottom of the page.

Homepage featured grids, recommended-product sections that load after the embed runs, and custom cards that have neither a matching title nor a `/products/{handle}` link are not covered automatically. Add the Product rating block to that section when the theme allows an app block on the card.

Do not add the full review widget twice. If the Product reviews section block and the Customer reviews embed are both enabled, the section block stays and the embed for that product is removed. The rating summary uses `shopify-review-rating` and does not render the review list or form.

Structured data was inspected in the theme extension. It does not emit Product or aggregateRating JSON-LD. Merchant themes already emit Product structured data, and a second Product script would conflict with it. No aggregate rating is invented for products with no approved reviews.

| Check | Result | Evidence |
| --- | --- | --- |
| Product page rating | NOT TESTED | The new Product rating block is not on the development-store theme. Publishing the extension was not authorized. |
| Collection page rating | NOT TESTED | The Product ratings embed was not enabled on the development store. |
| Zero-review state | PARTIAL | `summarizeRatingCounts([])` returns `{averageRating: null, reviewCount: 0}`. `starFills(null)` is five empty fills. No `0.0` or `5.0` is produced. The storefront empty text was not viewed. |
| Approved review calculation | PASS | Vitest: 80 fives, 30 fours, and 10 threes is 120 reviews and formats as `4.6`. `14/3` formats as `4.7`. `17/4` formats as `4.3`. Two fives format as `5.0`. One review has count 1. `starFills(4.8)` is four full stars and one 0.8 fill. |
| Rejected review exclusion | PASS | `includeInRating` is false for pending, rejected, deleted, another shop, and another product. `assemblePublicRatings` returns `{averageRating: null, reviewCount: 0}` for a product id owned by a different shop. |
| Rating click navigation | NOT TESTED | The storefront script links to `#shopify-product-reviews-{id}` and calls `scrollIntoView({behavior:'smooth'})` plus `focus` only when that section exists. No browser click was recorded. |
| Mobile test | NOT TESTED | No mobile viewport was opened. CSS sets `max-width: 100%` at 414px. |
| Theme Editor settings | NOT TESTED | Block settings exist for enable, star color, empty star color, star size, text size, count visibility, precision, alignment, spacing, click-to-reviews, empty text, write-a-review text, and count format. The theme editor was not opened. |
| Duplicate widget test | PARTIAL | `widget-placement.test.ts` still keeps the section widget and removes the embed for the same product. Rating nodes use a separate script and the `shopify-review-rating` class. Both blocks were not enabled together on the development store. |
| Security test | PASS | Vitest rejects an invalid shop, a missing signature, a tampered signature, a SQL-like product id, a `<script>` product id, a bad GID, 51 ids, and a query longer than 4000 characters. The batch response fixture contains average and count only. The live App Proxy was not called. |
| Regression test | PASS | `npm test` (52), `npm run typecheck`, `npm run lint`, `npm run build`, `npx prisma validate`, `npx prisma generate`, and `shopify app build` passed. Theme check reported no errors after the rating script was split into `product-rating.js` so each app-block JavaScript file stays under 10 KB. |
