# Billing

New public apps use Shopify App Pricing. Plans, trials, upgrades, downgrades, and merchant approval are configured and hosted through Shopify Partner Dashboard. The app reads the canonical contract through the Partner API `activeSubscription` and maps the returned plan handle to local feature limits.

The app must not implement Stripe, PayPal, Razorpay, external checkout, or a fake “connected” billing state. If legacy Billing API subscriptions are ever supported during migration, both sources must be checked as required by Shopify documentation.

The current service returns an explicit `not_configured` state until Partner API credentials and plan handles are configured. A missing or inactive subscription maps to the centrally defined free plan; it never grants paid features implicitly. Final plan handles, prices, trial length, and limits must be configured in Partner Dashboard and then mapped in `app/modules/plans/plans.ts`.
