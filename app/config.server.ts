import {z} from 'zod';

const envSchema = z.object({
  APP_NAME: z.string().min(1).default('Shopify Review'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SHOPIFY_API_KEY: z.string().min(1),
  SHOPIFY_API_SECRET: z.string().min(1),
  SHOPIFY_APP_URL: z.string().url(),
  SHOPIFY_API_VERSION: z.string().regex(/^\d{4}-\d{2}$/).default('2026-01'),
  SCOPES: z.string().default('read_products,read_orders,read_customers'),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().min(16),
  STORAGE_ENDPOINT: z.string().url().optional(),
  STORAGE_BUCKET: z.string().min(1).optional(),
  STORAGE_ACCESS_KEY: z.string().min(1).optional(),
  STORAGE_SECRET_KEY: z.string().min(1).optional(),
  EMAIL_PROVIDER: z.string().default('disabled'),
  EMAIL_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),
  SHOPIFY_PARTNER_ORG_ID: z.string().optional(),
  SHOPIFY_PARTNER_API_TOKEN: z.string().optional(),
  SHOPIFY_APP_ID: z.string().optional(),
});

export const config = envSchema.parse({
  ...process.env,
  SCOPES: process.env.SCOPES ?? 'read_products,read_orders,read_customers',
});

export const shopifyScopes = config.SCOPES.split(',')
  .map((scope) => scope.trim())
  .filter(Boolean);

export const isProduction = config.NODE_ENV === 'production';
