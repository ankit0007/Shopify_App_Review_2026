import {
  AppDistribution,
  DeliveryMethod,
  shopifyApp,
} from '@shopify/shopify-app-react-router/server';
import {PrismaSessionStorage} from '@shopify/shopify-app-session-storage-prisma';
import type {ApiVersion} from '@shopify/shopify-api';
import {db} from './db.server';
import {config, shopifyScopes} from './config.server';

const shopify = shopifyApp({
  apiKey: config.SHOPIFY_API_KEY,
  apiSecretKey: config.SHOPIFY_API_SECRET,
  apiVersion: config.SHOPIFY_API_VERSION as ApiVersion,
  scopes: shopifyScopes,
  appUrl: config.SHOPIFY_APP_URL,
  authPathPrefix: '/auth',
  distribution: AppDistribution.AppStore,
  sessionStorage: new PrismaSessionStorage(db),
  webhooks: {
    APP_UNINSTALLED: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: '/webhooks',
    },
  },
  future: {
    expiringOfflineAccessTokens: true,
  },
});

export default shopify;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const sessionStorage = shopify.sessionStorage;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
