import {config} from '../../config.server';
import {db} from '../../db.server';
import {getPlan, planForSubscription, type PlanDefinition} from '../plans/plans';

type AdminClient = {
  graphql: (query: string, options?: {variables?: Record<string, unknown>}) => Promise<Response>;
};

export class BillingService {
  async createSubscription(admin: AdminClient, planHandle: string, returnUrl: string) {
    const plan = getPlan(planHandle);
    if (plan.handle === 'free') throw new Error('Free plan does not require a subscription');
    const prices: Record<string, number | undefined> = {
      starter: config.SHOPIFY_PLAN_STARTER_PRICE,
      growth: config.SHOPIFY_PLAN_GROWTH_PRICE,
      pro: config.SHOPIFY_PLAN_PRO_PRICE,
    };
    const amount = prices[plan.handle];
    if (!amount) throw new Error('Billing price is not configured for this plan');
    const response = await admin.graphql(`#graphql
      mutation CreateSubscription($name: String!, $returnUrl: URL!, $amount: Decimal!) {
        appSubscriptionCreate(
          name: $name,
          returnUrl: $returnUrl,
          lineItems: [{appRecurringPricingDetails: {price: {amount: $amount, currencyCode: USD}, interval: EVERY_30_DAYS}}]
        ) {
          userErrors { field message }
          confirmationUrl
          appSubscription { id status }
        }
      }`, {variables: {name: plan.name, returnUrl, amount}});
    const body = await response.json() as {
      data?: {appSubscriptionCreate?: {confirmationUrl?: string; userErrors?: Array<{message: string}>}};
    };
    const errors = body.data?.appSubscriptionCreate?.userErrors ?? [];
    if (errors.length) throw new Error('Shopify billing rejected the subscription');
    if (!body.data?.appSubscriptionCreate?.confirmationUrl) throw new Error('Shopify billing returned no confirmation URL');
    return body.data.appSubscriptionCreate.confirmationUrl;
  }

  async cancelSubscription(admin: AdminClient, subscriptionId: string) {
    const response = await admin.graphql(`#graphql
      mutation CancelSubscription($id: ID!) {
        appSubscriptionCancel(id: $id) { userErrors { message } }
      }`, {variables: {id: subscriptionId}});
    const body = await response.json() as {data?: {appSubscriptionCancel?: {userErrors?: Array<{message: string}>}}};
    if ((body.data?.appSubscriptionCancel?.userErrors ?? []).length) {
      throw new Error('Shopify billing rejected cancellation');
    }
  }

  async getActiveSubscription(shopGid: string): Promise<{plan: PlanDefinition; status: string; provider: string}> {
    if (!shopGid || !config.SHOPIFY_PARTNER_ORG_ID || !config.SHOPIFY_PARTNER_API_TOKEN || !config.SHOPIFY_APP_ID) {
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
    const status = subscription ? 'active' : 'inactive';
    return {
      plan: planForSubscription(status, handle),
      status,
      provider: 'shopify_app_pricing',
    };
  }

  async canUseFeature(shopId: string, feature: string) {
    const subscription = await this.getSubscriptionForShop(shopId);
    return subscription.plan.features.includes(feature);
  }

  async getSubscriptionForShop(shopId: string) {
    const shop = await db.shop.findUnique({where: {id: shopId}, select: {shopifyShopId: true}});
    let subscription;
    try {
      subscription = await this.getActiveSubscription(shop?.shopifyShopId ?? '');
    } catch {
      subscription = {plan: getPlan('free'), status: 'billing_unavailable', provider: 'shopify_app_pricing'};
    }
    await db.subscription.upsert({
      where: {shopId_provider: {shopId, provider: subscription.provider}},
      update: {planHandle: subscription.plan.handle, status: subscription.status},
      create: {shopId, provider: subscription.provider, planHandle: subscription.plan.handle, status: subscription.status},
    });
    return subscription;
  }
}
