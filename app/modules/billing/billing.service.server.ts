import {config} from '../../config.server';
import {db} from '../../db.server';
import {getPlan, type PlanDefinition} from '../plans/plans';

export class BillingService {
  async getActiveSubscription(shopGid: string): Promise<{plan: PlanDefinition; status: string; provider: string}> {
    if (!config.SHOPIFY_PARTNER_ORG_ID || !config.SHOPIFY_PARTNER_API_TOKEN || !config.SHOPIFY_APP_ID) {
      return {plan: getPlan('free'), status: 'not_configured', provider: 'shopify_app_pricing'};
    }
    const response = await fetch(
      `https://partners.shopify.com/${config.SHOPIFY_PARTNER_ORG_ID}/api/${config.SHOPIFY_API_VERSION}/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.SHOPIFY_PARTNER_API_TOKEN}`,
        },
        body: JSON.stringify({
          query: `query ActiveSubscription($appId: ID!, $shopId: ID!) {
            activeSubscription(appId: $appId, shopId: $shopId) {
              items { handle }
              trialEndsAt
            }
          }`,
          variables: {appId: config.SHOPIFY_APP_ID, shopId: shopGid},
        }),
      },
    );
    if (!response.ok) throw new Error(`Shopify Partner API returned ${response.status}`);
    const body = await response.json() as {
      data?: {activeSubscription?: {items?: Array<{handle: string}>; trialEndsAt?: string | null} | null};
      errors?: unknown[];
    };
    if (body.errors?.length) throw new Error('Shopify Partner API returned GraphQL errors');
    const subscription = body.data?.activeSubscription;
    const handle = subscription?.items?.[0]?.handle;
    return {
      plan: getPlan(handle),
      status: subscription ? 'active' : 'inactive',
      provider: 'shopify_app_pricing',
    };
  }

  async canUseFeature(shopId: string, feature: string) {
    const subscription = await this.getSubscriptionForShop(shopId);
    return subscription.plan.features.includes(feature);
  }

  async getSubscriptionForShop(shopId: string) {
    const shop = await db.shop.findUnique({where: {id: shopId}, select: {shopifyShopId: true}});
    const subscription = await this.getActiveSubscription(shop?.shopifyShopId ?? '');
    await db.subscription.upsert({
      where: {shopId_provider: {shopId, provider: subscription.provider}},
      update: {planHandle: subscription.plan.handle, status: subscription.status},
      create: {shopId, provider: subscription.provider, planHandle: subscription.plan.handle, status: subscription.status},
    });
    return subscription;
  }
}
