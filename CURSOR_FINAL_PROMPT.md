# FINAL RELEASE PROMPT: Product Reviews app (redesign, finish, deploy, App Store ready)

> Paste everything below the line into Cursor (Agent mode, strongest model).
> Before pasting, put `review-widget-reference.html` in the repo at `docs/design/review-widget-reference.html`
> and fill in every value in section 0. Do NOT paste real passwords or API secrets into this prompt;
> those stay in `.env.production` on the server only.

---

You are the lead engineer finishing the Shopify app in this repository (`ankit0007/Shopify_Review`) for Shopify App Store submission. Stack already in place: React Router 7 + `@shopify/shopify-app-react-router`, Polaris 13, Prisma 6 + PostgreSQL, Docker Compose, a theme app extension at `extensions/review-widgets`, a worker (`app/worker.ts`), and production host `https://productreviews.it3.in`.

Read these first and treat them as the source of truth for what already exists and what is still broken:
`docs/development-store-e2e-report.md`, `docs/app-store-submission-checklist.md`, `docs/deployment.md`, `docs/security.md`, `shopify.app.toml`, `docker-compose.production.yml`, `deploy/nginx/productreviews.it3.in.conf`, `prisma/schema.prisma`, `extensions/review-widgets/**`, `app/routes/**`.

Do not rewrite working modules. Do not migrate away from Polaris React, React Router, or Prisma. Improve, finish, and ship.

## 0. Values from the owner (fill before running)

```
APP_DISPLAY_NAME     = ________   # unique, brandable. NOT "Product Reviews" (too generic / same as Shopify's old retired app) and must not contain "Shopify"
COMPANY_LEGAL_NAME   = ________
COMPANY_ADDRESS      = ________
SUPPORT_EMAIL        = ________
PRIVACY_EMAIL        = ________   # can equal SUPPORT_EMAIL
GOVERNING_LAW        = India, courts of ________
SSH_TARGET           = ________@187.124.157.194
SERVER_APP_DIR       = ________   # directory on the VPS where this repo is/will be cloned
SMTP_PROVIDER        = ________   # e.g. Brevo / Amazon SES / Zoho; credentials already in server .env.production or entered in /admin/smtp
DEV_STORE            = sftp-7qtjiorq.myshopify.com
```

If a value is blank, do not invent it. Use a clearly marked `TODO_OWNER` placeholder, finish everything else, and list the missing values at the end.

## 1. Authorization and safety rules for this run

- **Production deployment IS explicitly authorized in this run** (sections 7 and 8), including `shopify app deploy`. Earlier sessions stopped because deployment was not authorized; that restriction is lifted now.
- The VPS hosts other applications. Touch only: the `shopifyreview` Docker Compose project, containers/volume/network prefixed `shopifyreview-`, and the nginx server block for `productreviews.it3.in`. Never stop, prune, or edit anything else. Never run `docker system prune`, `docker volume prune`, or restart nginx without `nginx -t` passing first.
- Always back up the production database before running migrations.
- Never commit secrets. Never print secrets to the terminal output or logs.
- No placeholder text, "coming soon" screens, lorem ipsum, or dead navigation links may remain. Shopify reviewers reject apps for this.
- After each phase, run: `npm test && npm run typecheck && npm run lint && npm run build && npx prisma validate && shopify app build`. Fix failures before moving on.

## 2. Root cause of the bug in the current storefront screenshot

On the dev store product page, the compact rating under the title says "No reviews yet" while the review section below lists 2 reviews at 4.0. Per `docs/development-store-e2e-report.md`, `GET https://productreviews.it3.in/api/public/ratings` returns **404 from nginx**: the ratings route exists only locally, production runs an older build. Deploying the current code (section 7) fixes the data. Additionally verify in code that the compact rating and the full section read from the same approved-review aggregate so they can never disagree, and that a failed ratings request shows nothing (not "No reviews yet").

Also fix: review cards currently show the literal heading "Review" when a review has no title. If `title` is null/empty, render no title at all.

## 3. Storefront redesign (theme app extension)

Visual target: `docs/design/review-widget-reference.html`. Open it in a browser and match its layout, spacing, states, and interactions. It is a reference, not production code; port it into the existing extension files.

### 3.1 Compact rating block (`blocks/product-rating.liquid`, `assets/product-rating.js`)
- Stars with true partial fill (clip width, not rounding), bold average with one decimal, muted "(N reviews)".
- Whole thing is a link to `#shopify-product-reviews-{product.id}`; smooth scroll + focus the section heading.
- Zero approved reviews: show 5 empty stars + configurable "Be the first to review" text linking to the section, or hide entirely (new checkbox setting `hide_when_empty`, default false).
- Request failure or timeout (3 s): render nothing, log once with `console.warn`.
- Accessible name: "Rated 4.0 out of 5 stars, 2 reviews".
- Reserve height to avoid layout shift (CLS).

### 3.2 Full review section (`snippets/review-widget.liquid`, `assets/review-widgets.js`, `assets/review-widgets.css`)
Build exactly these parts, in this order:
1. **Heading** (setting, default "Customer Reviews").
2. **Summary card**: large average "4.0 / 5", star row, "Based on N reviews"; **rating histogram** 5→1 with bar fill and count; each bar is a button that filters the list (toggle; disabled when count is 0; `aria-pressed`); **"Write a review" button** on the right.
3. **Write-a-review panel**, collapsed by default, expands inline under the summary with a short animation. Contains: star picker built from 5 radio inputs (hover preview, keyboard arrows, labels Poor/Fair/Good/Very good/Excellent), title (optional, max 100), review body (required, min 10, max 5000, live counter), display name (required, max 60), a hidden honeypot field `website` (if filled, silently succeed without saving), note "Reviews are checked before they appear", submit button with loading state. Inline field errors, no `alert()`. On success replace the form with the green check success state ("Thank you! Your review will appear once approved"). **Do not add the email field shown in the reference**; the public form must not collect email.
4. **Toolbar**: "Showing X of N reviews", active filter chip with clear (×), sort select: Most recent / Highest rating / Lowest rating.
5. **Review cards**: initials avatar with deterministic color from the name, name, "Verified buyer" badge (only when `verifiedPurchase`), relative date ("3 days ago", absolute after 30 days, `<time datetime>`), stars, optional title, body with "Read more" after ~6 lines, safe text rendering only (`textContent`, never `innerHTML` with user data).
6. **Load more** button driven by the opaque cursor; hidden when no more pages.
7. **Loading skeleton** while the first request runs; **empty state** (dashed card, empty stars, "No reviews yet", "Write the first review" button that opens the panel).

Style rules:
- All colors via CSS custom properties on the widget root: `--sr-star`, `--sr-star-empty`, `--sr-accent`, `--sr-accent-text`, `--sr-text`, `--sr-muted`, `--sr-border`, `--sr-surface`, `--sr-radius`. Map them to block settings. Default `--sr-accent` and `--sr-text` to `currentColor`/theme text so the widget blends with dark and light themes.
- `font: inherit` everywhere; never load web fonts.
- Scope every selector under `.shopify-reviews` so theme CSS does not leak in and ours does not leak out.
- Responsive per reference at 320, 375, 390, 414, 768, 1024, 1440 px. No horizontal scroll.
- `prefers-reduced-motion` respected. Visible focus rings. WCAG AA contrast on defaults.
- Add `locales/en.default.json` strings for every user-facing text; settings text uses `t:` keys.

Theme-extension limits (theme check enforces these):
- Each JS file referenced by a block must stay **under 10 KB**. Split: `review-widgets.js` (list, summary, filters, sort, load more) and `review-form.js` (form + star picker) which is **lazy-loaded** by injecting a `<script>` with the asset URL (pass it via a `data-form-src="{{ 'review-form.js' | asset_url }}"` attribute) only when "Write a review" is clicked.
- Scripts `defer`, no jQuery, no external CDN, no inline `<script>` blocks with large payloads.
- Keep the existing single-widget deduplication (section block wins over embed).

New block settings (both the section block and the embed share them): heading text, star color, empty star color, accent color, reviews per page, default sort, show histogram, show sort, show avatar, show date, show verified badge, show review form, hide when empty (compact block), corner radius (0–24 px), empty-state text, submit button text. Every setting must actually change output; remove any setting that does nothing.

Optional SEO setting `enable_review_schema` (default **off**, help text warns merchants to enable only if their theme does not already output Product JSON-LD aggregateRating): when on and reviewCount ≥ 1, emit a single `application/ld+json` block with `AggregateRating` for that product. Never output it for zero reviews.

## 4. Public API changes (`app/routes/api.public.*`)

- Reviews endpoint returns, in addition to current fields: `distribution: {"5":n,"4":n,"3":n,"2":n,"1":n}` (approved only, via `groupBy`), `averageRating`, `totalReviews`.
- Accept `sort=newest|highest|lowest` and `rating=1..5`. The encrypted cursor must encode sort + filter + last position; a cursor used with a different sort/filter returns 400 `INVALID_CURSOR`. Malformed cursor returns 400, never 200 with empty list.
- Add a DB index supporting `(productId, status, rating, submittedAt)` via a new Prisma migration.
- Submission: accept the honeypot, trim inputs, reject >5000 chars, keep existing rate limits, duplicate check, and plan limit. Success response: `{status: "PENDING"}` or `{status: "APPROVED"}` when moderation mode is auto-approve for ratings ≥ merchant threshold (if that setting exists; do not add it otherwise).
- Keep App Proxy signature verification on every public route. Add unit tests for sort, filter, distribution, cursor/filter mismatch, honeypot.
- Add `Cache-Control: public, max-age=60, stale-while-revalidate=300` on GET responses (safe because only approved data is returned and the proxy signature is part of the URL).

## 5. Embedded admin polish (Polaris, App Bridge)

Navigation (`app/routes/app.tsx`): only pages that fully work. Remove any nav link to unimplemented pages (UGC/Media, Widgets, Email, Analytics, Import/Export, Integrations). Final nav: **Home**, **Reviews**, **Review requests**, **Settings**, **Plan**.

- **Home (`app._index.tsx`)**: Onboarding card with a 3-step checklist that auto-detects completion where possible:
  1. "Add star rating under product title" → button opens the theme editor deep link
     `https://{shop}/admin/themes/current/editor?template=product&addAppBlockId={SHOPIFY_API_KEY}/product-rating&target=mainSection`
  2. "Add reviews section to product page" → `...?template=product&addAppBlockId={SHOPIFY_API_KEY}/review-summary&target=newAppsSection`
  3. "Show ratings on collection pages" → `https://{shop}/admin/themes/current/editor?context=apps&activateAppId={SHOPIFY_API_KEY}/rating-embed`
  Open links with `target="_top"`. Below it: stat cards (average rating, total approved, pending moderation with link, requests sent / reviews collected), and a "Latest reviews" list. Proper empty states with illustration-free Polaris `EmptyState`.
- **Reviews (`app.reviews.tsx`)**: Polaris `IndexTable` with tabs All / Pending / Approved / Rejected (with counts), search (product, name, text), rating filter, pagination, row stars, verified badge, product title + thumbnail, date. Bulk actions: Approve, Reject, Hide, Delete (Delete behind a confirm modal). Row click opens a detail `Modal` with full text and single actions. Toasts via App Bridge for results. All mutations tenant-scoped and CSRF-safe, and write `AuditLog`.
- **Review requests (`app.requests.tsx`)**: make sure this page is deployed and works; show a warning `Banner` with a link to settings if email sending is not configured, instead of silently failing.
- **Settings (`app.settings.tsx`)**: sections Review requests (on/off, delay days, reminder, expiry), Moderation (manual / auto-approve), Appearance (defaults used by the widget when theme settings are empty). Use Polaris form layout + App Bridge `SaveBar` for unsaved changes. Validate with zod; show inline errors.
- **Plan (`app.plan-usage.tsx`)**: show current plan and usage bars. If Pro is not configured in Partner Dashboard managed pricing, do not show a broken upgrade button; show the Free plan only. Upgrade (when configured) must open Shopify's managed pricing page `https://admin.shopify.com/store/{store_handle}/charges/{app_handle}/pricing_plans` with `target="_top"`.
- Every loader calls `authenticate.admin`. Every page has a `TitleBar`, loading skeletons (`SkeletonPage`), and an error boundary with a friendly message and a retry button. No console errors inside Shopify Admin.
- Rename every visible "Product Reviews" string to `APP_DISPLAY_NAME` (also `name` in `shopify.app.toml` and extension names).

## 6. Public pages (required for the listing and review)

Create a shared `app/components/PublicLayout.tsx` (header with app name + links Features / Help / Support; footer with Privacy, Terms, Support, © year COMPANY_LEGAL_NAME). Plain server-rendered React, no Polaris, no App Bridge, minimal inline CSS (same design tokens as the widget), mobile-first, each page with `<title>`, meta description, canonical URL, Open Graph tags. Add them to `app/routes.ts` if routes are registered there.

1. **`/` (`_index.tsx`)**: KEEP the existing behaviour: if the request has a `shop` query param, redirect to `/app` preserving the query string. Otherwise render a landing page: hero (name, one-line value prop, "Install from Shopify App Store" button pointing to `TODO_OWNER_LISTING_URL` until the listing is live), 6 feature cards (star ratings under title, review section with filters, automated review request emails, moderation, verified buyer badges, theme-editor setup with no code), a "How it works" 3-step strip, pricing summary (Free plan details from `app/modules/plans/plans.ts`), FAQ (5 items), footer.
2. **`/privacy`**: use the template in Appendix A, fill values from section 0.
3. **`/terms`**: use the template in Appendix B.
4. **`/support`**: support email (mailto), expected response time "within 1 business day", link to help, and a FAQ covering: adding the rating block, adding the review section, collection-page ratings, why a review is not showing (moderation), how review emails are sent, uninstall/data deletion.
5. **`/help`**: installation guide with numbered steps and the three theme-editor steps from section 5 (text, no screenshots required).
6. **`/robots.txt`** (allow public pages, disallow `/app`, `/admin`, `/api`, `/review/`, `/unsubscribe/`) and **`/sitemap.xml`** for the 5 public pages.
7. Make sure nginx and the app serve these without auth, with HTTPS, and that `/admin` (platform admin) is `noindex`.

## 7. Production deployment (authorized)

Local gate first: `npm ci`, the full check command from section 1, then commit with message `release: v1.0.0 app store candidate` and push to `main`.

On the server (`ssh SSH_TARGET`, `cd SERVER_APP_DIR`):
1. `git fetch && git status` — if there are local changes on the server, stop and report them; do not discard.
2. Verify `.env.production` exists and contains every key in `.env.example` (print key names only, never values). Required at minimum: `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_APP_URL=https://productreviews.it3.in`, `SCOPES`, `DATABASE_URL` (compose overrides), encryption/session secrets, email/SMTP settings. Report missing keys and stop if Shopify keys are missing.
3. Backup: `docker exec shopifyreview-db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > ~/backups/shopifyreview-$(date +%F-%H%M).dump` (create `~/backups` if needed). Skip only if the DB container does not exist yet (first deploy).
4. `git pull --ff-only origin main`
5. `docker compose -p shopifyreview -f docker-compose.production.yml up -d --build` (migrations run on app start via `prisma migrate deploy`).
6. Wait for health: `curl -fsS http://127.0.0.1:3500/health` retry up to 60 s. If it fails: `docker logs --tail 200 shopifyreview-app`, fix, redeploy. If unrecoverable, roll back to the previous commit and restore nothing unless a migration broke data.
7. Nginx: if `/etc/nginx/sites-enabled/productreviews.it3.in.conf` (or the conf.d equivalent used on this host) is missing, install `deploy/nginx/productreviews.it3.in.conf`, run `sudo nginx -t`, then `sudo systemctl reload nginx`. If no certificate exists, `sudo certbot --nginx -d productreviews.it3.in --non-interactive --agree-tos -m SUPPORT_EMAIL`.
8. Smoke tests from outside the server:
   - `https://productreviews.it3.in/health` → 200
   - `/`, `/privacy`, `/terms`, `/support`, `/help` → 200 with correct content
   - `https://productreviews.it3.in/api/public/ratings?productIds=1` unsigned → **401** (proves route is deployed; 404 means old build)
   - `POST /webhooks` with bad HMAC → 401
   - worker container running: `docker ps --filter name=shopifyreview-worker`

Then from the local machine: `shopify app deploy --allow-updates` (releases app config, compliance webhook subscriptions, app proxy, and the theme extension as a new version). Confirm in output that the new version is released.

Add `scripts/deploy.sh` that performs steps 1–8 idempotently so the owner can redeploy later with one command, and document it in `docs/deployment.md`.

## 8. Post-deploy verification on the dev store

Use the browser only if it is logged in; otherwise produce a manual checklist for the owner. Verify on `DEV_STORE`:
- App opens inside Admin with no errors; every nav page loads.
- Uninstall + reinstall works; after reinstall OAuth completes and lands in the app (no manual shop entry).
- Theme editor deep links add the blocks; compact rating shows the same average/count as the section (4.0 / 2 reviews on "The Collection Snowboard: Liquid" if data unchanged).
- Only one review section renders even with block + embed both enabled.
- Submit a review from the storefront → appears as Pending in admin → Approve → appears on storefront; Reject → never appears.
- Filters, sort, load more, empty state, mobile 375 px.
- Lighthouse on a product page with and without the app: performance drop must be under 10 points. Report both numbers.

## 9. App Store compliance self-audit

Write `docs/app-store-release-report.md` with PASS / FAIL / OWNER ACTION per item:
- OAuth immediately on install, redirects to embedded UI, session tokens via App Bridge, works in Chrome incognito (third-party cookies blocked).
- Mandatory compliance webhooks registered (confirm via `shopify app deploy` output) and returning 200 on valid HMAC, 401 on invalid; `shop/redact` deletes all shop data; `customers/redact` removes/anonymizes that customer's PII; `customers/data_request` is recorded.
- `app/uninstalled` marks shop uninstalled and deletes sessions.
- Scopes are minimal and each is justified in the report (`read_products`, `read_orders`, `read_customers`).
- No nav links to missing pages, no placeholders, no console errors, no 404/500 anywhere reachable.
- Theme app extension only (no Script Tags, no theme file edits, no Asset API writes).
- Billing uses Shopify managed pricing only; no off-platform payment links.
- Public pages live over HTTPS; privacy policy URL, support email, app name consistent everywhere.
- Emails: review request emails include unsubscribe link and the merchant's shop name; sending fails visibly when SMTP is not configured. Expired unsubscribe tokens return the same safe page but do not throw.
- Security: XSS test with `<script>` and `<img onerror>` in name/title/body renders as text in admin and storefront; cross-shop access returns 404; rate limits active.

## 10. Final output to the owner

End with, in this order:
1. What was changed (short list of files/features).
2. Deployed version (git SHA + Shopify app version name) and smoke-test results.
3. Anything that failed or was skipped, with exact reason.
4. The owner's remaining manual steps in the Partner Dashboard (Appendix C), with any `TODO_OWNER` values still missing.

---

## Appendix A — Privacy Policy template (`/privacy`)

Render as clean HTML sections. Replace placeholders; keep "Last updated" as the deploy date.

**Privacy Policy for {APP_DISPLAY_NAME}** — Last updated {DATE}

{APP_DISPLAY_NAME} ("the App") is provided by {COMPANY_LEGAL_NAME} ("we"). This policy describes how the App collects, uses, and shares information when a merchant installs it on their Shopify store, and about customers of those stores.

1. **Information we collect.** When a merchant installs the App we access, through Shopify APIs and only within granted permissions: shop information (store name, domain, contact email); product information (ID, title, handle, image); order information needed to send review requests and confirm verified purchases (order ID and number, fulfillment date and status, purchased products); customer information needed for review requests (customer ID, name, email address). Store customers who submit a review provide a rating, optional title, review text, and a display name. We temporarily process IP addresses to prevent spam and abuse (rate limiting); they are not stored with reviews.
2. **How we use it.** To display approved reviews and ratings on the merchant's store; to send review request and reminder emails on the merchant's behalf; to mark reviews as verified purchases; to let merchants moderate reviews; to provide support, secure, and improve the App. We do not sell personal information and do not use it for advertising.
3. **Storage and security.** Data is stored on servers operated by our hosting provider. Customer email addresses are encrypted at rest, connections use HTTPS, and access is limited to authorised personnel.
4. **Sharing.** We share information only with service providers that help us run the App (hosting provider, email delivery provider {SMTP_PROVIDER}), with Shopify as required to operate the App, or when required by law. Approved review content and display names are public on the merchant's storefront.
5. **Retention.** We keep data while the App is installed. When a merchant uninstalls the App, Shopify sends a shop data erasure request after 48 hours and we permanently delete that store's data. Customer redaction requests from Shopify are processed within 30 days.
6. **Your rights.** If you are a customer of a store using the App, contact that store to access, correct, or delete your data; merchants can remove reviews at any time. Residents of the EEA, UK, California, and other regions may have additional rights (access, rectification, erasure, objection, portability). You may also contact us at {PRIVACY_EMAIL}.
7. **Email preferences.** Every review request email contains an unsubscribe link.
8. **Changes.** We may update this policy and will change the "Last updated" date.
9. **Contact.** {COMPANY_LEGAL_NAME}, {COMPANY_ADDRESS}, {PRIVACY_EMAIL}.

## Appendix B — Terms of Service template (`/terms`)

Sections: 1 Acceptance (installing the App means accepting these terms and Shopify's terms); 2 The service (review collection, display, moderation, review request emails); 3 Merchant responsibilities (lawful use, compliance with consumer-protection and review laws, no fake or incentivised reviews without disclosure, having a lawful basis to email customers); 4 Fees (billed through Shopify; plans shown in the App; changes with 30 days' notice); 5 Content (merchants own their review content and grant us a licence to host and display it for the App's purpose; we may remove unlawful content); 6 Availability (provided "as is", reasonable efforts for uptime, no guarantee); 7 Limitation of liability (to the maximum extent permitted by law, total liability limited to fees paid in the prior 3 months); 8 Termination (merchant may uninstall any time; data deleted per the Privacy Policy); 9 Changes to terms; 10 Governing law ({GOVERNING_LAW}); 11 Contact ({SUPPORT_EMAIL}).

## Appendix C — Owner's Partner Dashboard steps (list these in the final output)

1. App setup → confirm App URL and redirect URL are `https://productreviews.it3.in`.
2. API access → **Protected customer data**: request access, select name and email fields, explain use (review request emails, verified purchase), confirm data protection answers.
3. Pricing → Managed pricing: start with a Free plan (add Pro later once billing is tested).
4. Distribution → Public (App Store).
5. App listing: name {APP_DISPLAY_NAME}, 1200×1200 icon, 3–6 screenshots at 1600×900 (storefront widget, compact rating, admin moderation, settings), feature bullets, description, privacy policy URL `https://productreviews.it3.in/privacy`, support email, FAQ/support URL `/support`, demo screencast (install → add blocks → submit review → approve → shows on store).
6. Testing instructions for reviewers: dev store URL, storefront password, steps to add the blocks, and note that reviews need approval.
7. Emergency developer contact filled in.
8. Run the automated pre-submission checks in the listing page, fix anything flagged, then Submit for review.
