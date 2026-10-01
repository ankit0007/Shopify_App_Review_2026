# App Store submission checklist

Date: 2026-09-29

This checklist is for the Phase 1 Product Reviews app at `https://productreviews.it3.in`. Production was not deployed or submitted during this pass. Do not treat a local PASS as a live-store PASS.

## Phase 2 — not in this release

AI review generation, AI moderation, rewards, video transcoding, advanced analytics, advanced galleries, extra integrations, Shopify Flow, and recommendation systems stay deferred. The storefront does not offer photo or video upload until object storage is configured.

## Checklist

| Item | Status | What remains |
| --- | --- | --- |
| App name | PASS | `shopify.app.toml` name is Product Reviews. |
| Application URL and OAuth callback | PASS | Both use `https://productreviews.it3.in`. No ngrok URL is configured. |
| Managed installation | PASS | Embedded app uses the Shopify React Router auth path. A staff login on the development store was not repeated in this pass. |
| Scopes | PASS | `read_products`, `read_orders`, `read_customers`. Protected customer data approval is still a Partner Dashboard step. |
| Multi-tenant isolation | PASS | Shop-scoped queries and purchase matching require the same shop, customer, fulfilled order, and line-item product. |
| Review submission and moderation | PASS | Public and token submissions create pending reviews. Merchant admin approve/reject routes exist. They were not clicked inside Shopify Admin in this pass. |
| Star ratings | PASS | Storefront and admin render filled stars from the stored rating. The live theme still needs the current extension release. |
| Verified purchase | PASS | Local rule requires the same shop, customer, fulfilled order, and product line. A real development-store order was not created. |
| Storefront widget | PARTIAL | Local extension keeps one widget per product when both the section block and body embed are enabled. The installed development store still serves the older extension until deployment is authorized. |
| Theme settings | PASS | Star color, reviews per page, form, name, date, verified badge, empty message, and submit label are the settings the extension reads. |
| Pagination | PASS | The widget requests the next opaque cursor. The live store has not been retested after the cursor change. |
| Review requests and email | PASS | Local worker accepted one message through the mock SMTP server, skipped ineligible requests, and blocked a duplicate send. |
| SMTP and platform admin | PASS | Local `/admin` login, settings, test connection, test email, templates, logs, audit, and system health passed. Production SMTP is not entered. |
| Unsubscribe | PARTIAL | A valid token opts the customer out and later requests are cancelled. An unknown token returns HTTP 410. An expired token still opts out instead of returning an error. |
| GDPR handlers | PASS | `customers/data_request`, `customers/redact`, and `shop/redact` are handled with HMAC checks and idempotent event ids. An unknown shop for those topics returns HTTP 200. |
| GDPR registration | MANUAL ACTION REQUIRED | `shopify.app.toml` now declares `compliance_topics`. Shopify receives that subscription only after an authorized `shopify app deploy`. Do not deploy until requested. |
| App Proxy | PASS | Signed storefront requests and direct unsigned requests were tested earlier. Cross-shop data is filtered by the shop domain on the signed request. |
| Billing | PARTIAL | The plan page reads Shopify subscription status and shows Free unless the status is `active`. No charge is created in tests. Partner Dashboard still needs Free and Pro App Pricing handles. Starter and Growth remain internal mappings only if Shopify returns those handles. |
| Photo and video | NOT CONFIGURED | The review link hides the file input when storage environment variables are empty. A posted file is rejected before a review is saved. Advanced media processing is Phase 2. |
| HTTPS and Nginx | MANUAL ACTION REQUIRED | `deploy/nginx/productreviews.it3.in.conf` proxies only `productreviews.it3.in` to `127.0.0.1:3500`. It has not been installed. |
| Docker | PASS | `docker-compose.production.yml` defines `shopifyreview-app`, `shopifyreview-db`, a private network, a named volume, no public database port, and localhost `3500`. It was not started on the VPS. |
| Production database | MANUAL ACTION REQUIRED | Migrations through `0007_platform_smtp_admin` are applied on local `shopify_review_dev` only. |
| Production SMTP | MANUAL ACTION REQUIRED | Enter hostname, port, and TLS mode in `/admin/smtp` after a read-only inspection. Do not copy another app's password into Git. |
| Privacy policy, terms, support contact, support URL | MANUAL ACTION REQUIRED | These business and legal values are not in the repository and must not be invented. |
| Listing icon, screenshots, description, demo video, test credentials | MANUAL ACTION REQUIRED | Partner Dashboard listing assets are not in this repository. |
| Development-store install of this build | NOT TESTED | Shopify Admin login was not available in the test browser, and this build was not deployed. |
| Automated regression | PASS | Recorded after the commands in the final report. |
| App Store submission | NOT TESTED | The app was not submitted. |

## Partner Dashboard actions

1. Deploy the app configuration only after explicit approval so the compliance webhook subscription is registered.
2. Confirm protected customer data access for `read_orders` and `read_customers`.
3. Create Shopify App Pricing plans named Free and Pro. Leave the app on Free until a merchant approves Pro.
4. Add the privacy policy URL, terms URL, support email, and support URL.
5. Upload the icon, screenshots, description, and demo screencast.
6. Provide App Store review credentials for the development store.
7. In the theme editor, enable either the review block or the body embed for each product section, not both. The extension removes a duplicate if both are enabled.
