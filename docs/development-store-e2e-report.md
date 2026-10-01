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

Local code now declares the three mandatory compliance webhook topics in `shopify.app.toml` and returns HTTP 200 for those topics when the shop is already gone. The review-link form hides photo and video upload until object storage is configured, and a posted file is rejected before a review is saved. `deploy/nginx/productreviews.it3.in.conf` is prepared and was not installed. The submission checklist is `docs/app-store-submission-checklist.md`.

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

## Flexible Product Rating Placement E2E Test

Date: 2026-10-01

The product-page rating stays where the merchant places the Product rating app block. The script does not move that block and does not match product titles. Card ratings are a separate fallback from the Product ratings app embed.

### Supported placement

- **Product page:** In the theme editor, open the product template, add the Product rating block, and drag it among the other blocks in the product information section. That block is the only rating for that product on the product page. If the Product ratings embed is also enabled, it removes its copy for that product. Clicking the summary still scrolls to the Product reviews section when that section is on the page.
- **Product card, when the theme allows an app block:** Add the same Product rating block inside the product card section. It uses that card's Liquid `product.id` and is not moved.
- **Collection, search, featured, related, and recommended grids:** Enable the Product ratings app embed. It places one compact rating per card. Collection and search products rendered by Liquid already carry `product.id`. Cards added later are matched by a `/products/{handle}` link, or by a `data-product-id` already on the card. A handle is resolved to a numeric id through the storefront `/products/{handle}.js` response, then included in the existing batch ratings request. A title is never used as an identifier.
- **Position inside a card:** after the product title, otherwise before the price, otherwise inside the product-information container. Ratings are not placed over images. If none of those containers can be identified, the card is left unchanged.
- **Duplicates:** a card receives `data-shopify-review-rating-mounted` after a rating is added. The observer watches for new card markup and ignores nodes the rating script itself inserted, so it does not keep injecting the same rating.
- **Settings:** the product block and the embed use the same setting list. Values are not hard-coded.
- **Limits:** one `GET /api/public/ratings` batch contains at most 50 product ids. Ids already fetched on the page are not requested again.

Local validation on 2026-10-01 passed: `npm test` (59), `npm run typecheck`, `npm run lint`, `npm run build`, `npx prisma validate`, `npx prisma generate`, and `shopify app build`. Theme check reported no errors or warnings for this extension.

### Development-store verification

Date: 2026-10-01

Store: `sftp-7qtjiorq.myshopify.com`. Live theme: `test-data` (`158207312037`).

`shopify app deploy --allow-updates` released app version `product-reviews-5` to the Product Reviews app. That release did not SSH to production, did not change the production host, and did not change `application_url` in `shopify.app.toml`. The Shopify CLI is authenticated as the app owner. The development store is still marked “Not yet configured” inside `shopify app info`, but theme commands can read this store.

A direct `GET https://productreviews.it3.in/api/public/ratings?productIds=1` returned HTTP 404 from nginx. The ratings route exists only in the local app. The app proxy still targets that host, so the released extension cannot load rating numbers until that web app is deployed. Production deployment was not performed.

The storefront redirects to `/password`. This browser session does not have the store password. The theme editor URL redirected to Shopify login, and the page reported that captcha could not load. No product, collection, search, or settings screen was rendered.

The live theme JSON, pulled read-only, contains the Product reviews block `review-summary` on the product template and the enabled `review-embed` app embed. It does not contain the Product rating block or the Product ratings embed. The product template order is main, then customer reviews, then related products. The related-products section has the theme’s own `show_rating` set to false.

| Check | Result | Evidence |
| --- | --- | --- |
| Product page | NOT TESTED | The storefront stopped at the password page. The product template does not yet include the Product rating block. |
| Theme Editor placement | NOT TESTED | `https://admin.shopify.com/store/sftp-7qtjiorq/themes/158207312037/editor` redirected to Shopify login. Captcha did not load. The block was not added or moved. |
| Collection | NOT TESTED | No collection page was opened. The Product ratings embed is not enabled in `settings_data.json`. |
| Search | NOT TESTED | No search results page was opened. |
| Featured products | NOT TESTED | The homepage was not opened past the password page. |
| Recommendations | NOT TESTED | The product template has a related-products section, but the page was not rendered and the rating embed is not enabled. |
| Dynamic loading | NOT TESTED | No filter, pagination, or section refresh was clicked. |
| Duplicate prevention | NOT TESTED | The new rating block and rating embed were not both enabled on a rendered product page. The theme JSON still enables both the Product reviews block and the review embed. |
| Zero-review state | NOT TESTED | No product page was rendered. |
| Mobile | NOT TESTED | No storefront viewport was measured. |
| Accessibility | NOT TESTED | No rendered rating was available for the accessibility tree, keyboard, or screen reader. |
| Settings | NOT TESTED | Theme editor settings were not opened, so no color, size, count, or empty-text change was seen on the storefront. |
| Security | PARTIAL | Local tests still reject a bad shop, a bad signature, malformed ids, and another shop’s product id. The live ratings URL returned HTTP 404, so this session did not observe App Proxy signature behavior for that route. No customer email, token, or database id was present in that 404 response. |
| Performance | NOT TESTED | No storefront network log was captured. The ratings request could not be batched in the browser because the page did not load. |
| Regression | PASS | This verification did not change application code. The earlier local run in this session passed `npm test` (59), typecheck, lint, build, Prisma validate, Prisma generate, and `shopify app build`. |

## Final App Store Readiness

Date: 2026-10-01

Local gate: `npm test` 64 passed, `npm run typecheck`, `npm run lint`, `npm run build`, `npx prisma validate`, `npx prisma generate`, and `shopify app build` passed. Local `prisma migrate status` was pending `0008_review_list_index` until `prisma migrate deploy` applied it to local `shopify_review_dev`. After that, local status was up to date.

Production backup before the release: `/opt/shopifyreview/backups/shopify_review_db_20260930T212418Z.dump` (69,552 bytes, 157 archive entries, `pg_restore -l` succeeded). Volume `shopifyreview-db-data` was present and was not deleted. Database container `shopifyreview-db` was not recreated.

Production migration `0008_review_list_index` applied to `shopify_review_db`. `shopifyreview-app` and `shopifyreview-worker` were recreated on image `sha256:304c6dcaf7d5379f76a14d8eec7c90991cbb456dec7454055b14283b25c928ab`. Both reported healthy. The database container start time stayed `2026-09-28T17:44:15Z`. App port remained `127.0.0.1:3500`. The worker has no published port.

Extension version `product-reviews-6` was released to the Product Reviews app: https://dev.shopify.com/dashboard/128982372/apps/429153976321/versions/1150390861825

| Check | Result | Evidence |
| --- | --- | --- |
| Local tests | PASS | 64 Vitest tests, typecheck, lint, production build, Prisma validate/generate, and `shopify app build` exited 0. |
| Development store | PARTIAL | Store `sftp-7qtjiorq.myshopify.com` loaded without a password wall. Shopify Admin and the theme editor were not opened. |
| Storefront product page | PASS | `The Collection Snowboard: Liquid` showed one compact rating, `Rated 4.0 out of 5 stars, 2 reviews`, directly under the title in the product-info app block. One Customer Reviews section showed `4.0 / 5`, `Based on 2 reviews`, histogram 5:0 and 4:2, two cards (Anwit, Ankit Saxena), no empty title, and no verified badge. |
| Rating click | PASS | Activating the rating focused `#shopify-product-reviews-10746305609893` and moved that section to the top of the viewport. |
| Review form | PASS | The form stayed closed until Write a review. Fields were rating, optional title, body, display name, and a honeypot. No email field. Submit showed `Sending...`, then `Thank you for your review! It will appear here once it has been approved.` The name `Store Test` did not appear in the public list. |
| Star filter and sort | PARTIAL | The 4-star histogram button became pressed and showed `4 star only`. Both existing reviews are 4 stars, so the list stayed at 2 of 2. Sort options Most recent, Highest rating, and Lowest rating were present. Load more was not shown because both reviews fit on one page. |
| Collection | PARTIAL | `/collections/automated-collection` rendered 6 product cards and no review form in the footer. Compact ratings were absent because the Product ratings embed is not enabled on this theme. |
| Search | PARTIAL | Search for snowboard returned 13 products, no compact ratings, and no review form in the footer. |
| Homepage cards | PARTIAL | Featured products rendered titles and prices. No compact rating was injected. The footer did not contain a review form. |
| Recommendations | PARTIAL | Related products on the product page showed titles and prices only. |
| Footer | PASS | Product, collection, search, and homepage footers did not contain Customer Reviews or Write a review. One full review section remained on the product template. |
| Mobile | PARTIAL | A 390px-wide viewport stacked the product title under the image. The review histogram, Write a review, and sort control were in the accessibility tree. The compact rating was not visible in that top-of-page screenshot. |
| Admin | PASS | Unauthenticated `GET /admin` returned 302 to `/admin/login`. Login returned 302 with `platform_admin` cookie flags HttpOnly, Secure, and SameSite=Lax. `/admin`, `/admin/dashboard`, `/admin/smtp`, `/admin/email-templates`, `/admin/email-logs`, `/admin/audit-log`, and `/admin/system` returned 200. The password was not present in those HTML responses. |
| SMTP | PARTIAL | The SMTP password box did not use the configured placeholder `---`, and the HTML did not contain a password or `encryptedPassword`. Production `EMAIL_PROVIDER` is `disabled`. No test email was sent. |
| Email templates | NOT TESTED | The templates page returned 200. Template HTML escaping was not exercised in the browser during this pass. |
| Email logs | NOT TESTED | The logs page returned 200. No new delivery was created. |
| Audit | NOT TESTED | The audit page returned 200. Individual audit rows were not inspected. |
| Unsubscribe | NOT TESTED | No unsubscribe token was exercised against production. |
| Worker | PASS | `shopifyreview-worker` health became healthy on the new image and stayed healthy after the app recreate. No email was sent because the provider is disabled. |
| GDPR | NOT TESTED | Compliance topics are in `shopify.app.toml` and were included in the `product-reviews-6` release. A live webhook was not sent. |
| Billing | PARTIAL | The app does not create a charge during tests. Production env has no `SHOPIFY_PARTNER_ORG_ID` and no `SHOPIFY_APP_ID`. Partner pricing handles were not created. |
| Security | PASS | Unsigned ratings with a valid shop returned 401 `INVALID_SIGNATURE`. An invalid shop returned 400 `INVALID_SHOP`. A request without a shop returned 400 `MISSING_SHOP`. None of those bodies contained a credential. |
| Production health | PASS | `https://productreviews.it3.in/` returned 200. `/health` returned `{"success":true,"data":{"status":"ok","database":"ok"}}`. `/api/public/ratings` is served by the app and is no longer HTTP 404. |
| Existing-site safety | PASS | After the release, these returned HTTP 200 and their containers kept their earlier start times: artifyanni.com, crmassistant.it3.in, instagramfeed.it3.in, reports.it3.in, sftpshopify.it3.in. |
| Partner Dashboard | PARTIAL | App URL, OAuth callback, scopes, App Proxy, and compliance topics are in the released app version. Protected customer data approval, Free and Pro pricing, support email, privacy policy, and terms were not confirmed in the dashboard. |
| App Store listing | NOT TESTED | Icon, screenshots, descriptions, demo video, support URL, privacy policy, terms, and review credentials are not in the repository and were not submitted. |

A pending storefront review titled `Readiness check` from `Store Test` was submitted on The Collection Snowboard: Liquid. It is not public. Approve or delete it from the merchant Reviews screen. The installed Product rating block still has its saved star size of 16px; the block default for a newly added block is 20px. The theme editor was not used to change that saved value.

## Final Shopify App Store Readiness

Date: 2026-10-01

This pass did not deploy, did not submit the app, and did not send a new email. Storefront checks used the already installed development store `sftp-7qtjiorq.myshopify.com`. Shopify Admin was not logged in, so merchant screens were not clicked.

### 1. Features verified

| Area | Status | Evidence |
| --- | --- | --- |
| OAuth / install | NOT TESTED | Embedded admin was not opened. Unauthenticated `GET /app` returned HTTP 410. |
| Uninstall | NOT TESTED | No uninstall was performed. `app/uninstalled` is declared in `shopify.app.toml` and handled in `app/routes/webhooks.ts`. |
| App Proxy | PARTIAL | The storefront loaded reviews through `/apps/shopify-review/reviews`. A new unsigned-signature probe was not repeated in this pass. |
| Product page rating | PASS | On The Collection Snowboard: Liquid, the title block exposed `Rated 3.8 out of 5 stars from 4 reviews`. |
| Review section | PASS | Same page showed 3.8 / 5, Based on 4 reviews, histogram counts 5:1, 4:2, 3:0, 2:1, 1:0, sort, and Load more. `(5+8+2)/4 = 3.75`, shown as 3.8. The longest bar was the count of 2. |
| Write a review button | PARTIAL | The button was absent on that product page. Code and the shop setting default keep it off unless `showWriteReviewButton` is true. The ON state was not toggled in the browser. |
| View all reviews | PASS | The button opened `https://sftp-7qtjiorq.myshopify.com/apps/shopify-review/reviews`. The page showed 10 real approved reviews, average 3.6, distribution 5:3, 4:3, 3:2, 2:1, 1:1, product links, dates, and verified badges only on some reviews. |
| View all button position | PARTIAL | On the live theme the button sits on the right of the summary card, not beside the heading. Source now places it on the heading row. That source change was not deployed. |
| Site-wide Reviews tab | PASS | A Reviews control was present on the product page, the all-reviews page, and `/collections/all`. |
| Collection / search / homepage card ratings | FAIL | `/collections/all` listed 12 products and no rating control. Search and the homepage were not reopened. Related products on the product page said “Be the first to review.” |
| Footer form | PASS | The product page, all-reviews page, and collection page footers had no review form. |
| Mail-link review approval | PASS | Reviews submitted today for order #1003 products are public: Ayumu Hirano on The Collection Snowboard: Oxygen and Selling Plans Ski Wax are marked Verified buyer. The unfulfilled snowboard review from the same name is public and not marked verified. `submitReview` sets `status: 'APPROVED'` only for the mail-link path. The storefront form path still writes `PENDING`. |
| Automatic order emails | FAIL | Shopify Admin API still rejects order reads with `This app is not approved to access the Order object.` No new email was sent in this pass. An earlier EmailDelivery for order #1003 to the masked test recipient was `ACCEPTED`; that did not use the Order API. |
| Admin dashboard, moderation, pagination, manual review | NOT TESTED | Shopify Admin login was not available. Unit tests cover page size, filters, and admin review parsing. No fake metric literals were found in `app/components/admin/dashboard-view.tsx`; the screen itself was not opened. |
| SMTP password exposure | NOT TESTED | The platform SMTP screen was not opened in this pass. |
| Billing | NOT TESTED | No charge was created. Partner pricing handles were not confirmed. |
| GDPR live delivery | NOT TESTED | A POST to `/webhooks` without HMAC returned HTTP 401. Compliance topics are in `shopify.app.toml`. A signed compliance webhook was not delivered. |
| Theme extension build | PASS | `shopify app build` completed with theme check and no reported errors. `review-widgets.js` is 8,375 bytes. `product-rating.js` was not edited and is 9,947 bytes. `all-reviews-tab.js` is 3,907 bytes. |

### 2. Tests executed

All of these exited 0 on 2026-10-01:

- `npm test`: 29 files, 119 tests
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npx prisma validate`
- `npx prisma generate`
- `npx prisma migrate status` against local `shopify_review_dev`: 13 migrations, schema up to date
- `npx shopify app build`

### 3. Browser tests

- Product page loaded. Rating, histogram, three review cards, Load more, sort, View all reviews, and the side Reviews tab were visible. Write a review was not in the accessibility tree.
- View all reviews opened the shop-wide page and rendered 10 database reviews. Distribution counts match the 3.6 average.
- Collection page loaded 12 products, the Reviews tab, and no card ratings.
- Invalid `/review/not-a-real-token` returned HTTP 200 and the text “This review link is not available.” No stack trace was in the visible message.
- `https://productreviews.it3.in/health` returned HTTP 200. `/admin/login` returned HTTP 200.

### 4. Email tests

No email was sent in this pass. The earlier order #1003 send is not repeated here as a new inbox check. Subject, From, Reply-To, images, and the received HTML were not opened in a mailbox during this pass.

### 5. Security tests

- Unauthenticated `/app`: HTTP 410
- Webhook POST without HMAC: HTTP 401
- Invalid review token: safe message, HTTP 200
- XSS, CSRF, cross-shop mutation, and SMTP API abuse were not re-executed in the browser. Existing unit tests for signatures, CSRF, SMTP error redaction, and template escaping passed.

### 6. Database / migration status

Local development database is at migration `0013_review_request_test_mode`. Production was not migrated or deployed in this pass. This pass did not query production for new rows.

### 7. Shopify configuration

`shopify.app.toml` still has application URL `https://productreviews.it3.in`, redirect `https://productreviews.it3.in/auth/callback`, scopes `read_products,read_orders,read_customers`, App Proxy prefix `apps` and subpath `shopify-review`, API version `2026-01`, `app/uninstalled`, compliance topics, and `orders/fulfilled` plus `fulfillments/create`. There is no `read_fulfillments` scope.

### 8. Partner Dashboard requirements

- Protected customer data approval for the Order object. Until Shopify grants it, the app cannot read order #1003, including line items, through the Admin API.
- Fulfillment webhook topics in the repo were previously rejected on deploy for that same protected-data restriction. They are not a live subscription until a deploy Shopify accepts.
- App Pricing handles, if billing is part of the listing, were not confirmed.
- Review staff credentials for the development store must be entered in the listing. They are not in this repository.

### 9. Listing requirements

NOT TESTED. Icon, screenshots, feature list, demo video, support URL, and emergency contact are not in the repository and were not uploaded.

### 10. Legal requirements

NOT TESTED. Privacy policy URL, terms, and data-retention answers were not confirmed in the Partner listing. The app stores review text, reviewer display names, encrypted customer email when Shopify provides it, and encrypted SMTP configuration. Those answers must be written by the business. They were not invented here.

### 11. Remaining blockers

1. Shopify has not approved this app to access the Order object.
2. Automatic fulfillment emails cannot be proven end to end until that approval exists and the fulfillment webhook version is accepted.
3. Collection, search, and homepage product-card ratings are not showing on the live theme.
4. Merchant admin flows were not clicked: pagination, filters, approve/reject, and manual Add Review.
5. Listing, privacy policy, terms, support URL, and review credentials are missing from the Partner submission.
6. The heading-row placement of View all reviews is only in the local extension source. The live theme still shows the button on the summary card.

### 12. Exact steps still required before Submit for review

1. In the Partner Dashboard, request protected customer data access for orders and customers. Do not work around a denial.
2. After approval, deploy the app version only when asked, including compliance webhooks. Add `read_fulfillments` only if Shopify requires it for the fulfillment topics, then confirm those subscriptions are accepted.
3. In the theme editor, enable product-card ratings on collection and search if that placement is required for the listing, and confirm one review section per product.
4. Sign in to the development store and click Dashboard, Reviews pagination, filters, Add Review, Settings, and Review Requests.
5. Add the privacy policy, terms, support email, support URL, icon, screenshots, description, and a staff test account.
6. Create the App Pricing plans the listing will name.
7. Only then use Submit for review. This pass did not click it.
