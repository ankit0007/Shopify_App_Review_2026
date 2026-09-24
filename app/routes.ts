import type {RouteConfig} from '@react-router/dev/routes';
import {index, route} from '@react-router/dev/routes';

export default [
  index('routes/_index.tsx'),
  route('auth/*', 'routes/auth.$.tsx'),
  route('health', 'routes/health.ts'),
  route('webhooks', 'routes/webhooks.ts'),
  route('review/:token', 'routes/review.$token.tsx'),
  route('api/public/products/:productId/reviews', 'routes/api.public.products.$productId.reviews.ts'),
  route('app', 'routes/app.tsx', [
    index('routes/app._index.tsx'),
    route('reviews', 'routes/app.reviews.tsx'),
    route('settings', 'routes/app.settings.tsx'),
    route('plan-usage', 'routes/app.plan-usage.tsx'),
  ]),
] satisfies RouteConfig;
