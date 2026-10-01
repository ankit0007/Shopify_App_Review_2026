import type {Config} from '@react-router/dev/config';

export default {
  ssr: true,
  allowedActionOrigins: ['admin.shopify.com', 'productreviews.it3.in'],
} satisfies Config;
