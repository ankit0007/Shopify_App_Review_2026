import type {RouteConfig} from '@react-router/dev/routes';
import {index, layout, route} from '@react-router/dev/routes';

export default [
  layout('routes/public.tsx', [
    index('routes/_index.tsx'),
    route('privacy', 'routes/public.privacy.tsx'),
    route('faq', 'routes/public.faq.tsx'),
    route('changelog', 'routes/public.changelog.tsx'),
    route('tutorial', 'routes/public.tutorial.tsx'),
    route('docs', 'routes/public.docs.tsx'),
    route('support', 'routes/public.support.tsx'),
  ]),
  route('auth/*', 'routes/auth.$.tsx'),
  route('health', 'routes/health.ts'),
  route('webhooks', 'routes/webhooks.ts'),
  route('review/:token', 'routes/review.$token.tsx'),
  route('review-request/:token', 'routes/review-request.$token.tsx'),
  route('api/public/products/:productId/reviews', 'routes/api.public.products.$productId.reviews.ts'),
  route('api/public/reviews', 'routes/api.public.reviews.ts'),
  route('api/public/storefront/:file', 'routes/api.public.storefront.$file.ts'),
  route('api/public/ratings', 'routes/api.public.ratings.ts'),
  route('unsubscribe/:token', 'routes/unsubscribe.$token.tsx'),
  route('admin/login', 'routes/admin.login.tsx'),
  route('admin', 'routes/admin.tsx', [
    index('routes/admin._index.tsx'),
    route('dashboard', 'routes/admin.dashboard.tsx'),
    route('smtp', 'routes/admin.smtp.tsx'),
    route('email-templates', 'routes/admin.email-templates.tsx'),
    route('email-logs', 'routes/admin.email-logs.tsx'),
    route('system', 'routes/admin.system.tsx'),
    route('audit-log', 'routes/admin.audit-log.tsx'),
  ]),
  route('app', 'routes/app.tsx', [
    index('routes/app._index.tsx'),
    route('reviews', 'routes/app.reviews.tsx'),
    route('reviews/products', 'routes/app.reviews.products.ts'),
    route('requests', 'routes/app.requests.tsx'),
    route('settings', 'routes/app.settings.tsx'),
    route('plan-usage', 'routes/app.plan-usage.tsx'),
  ]),
] satisfies RouteConfig;
