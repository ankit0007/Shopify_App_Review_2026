import {config} from '../../config.server';

export class ShopifyService {
  async adminGraphql<T>(shop: string, accessToken: string, query: string, variables?: Record<string, unknown>) {
    const response = await fetch(`https://${shop}/admin/api/${config.SHOPIFY_API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify({query, variables}),
    });
    if (!response.ok) throw new Error(`Shopify Admin API returned ${response.status}`);
    const body = await response.json() as {data?: T; errors?: unknown[]};
    if (body.errors?.length) throw new Error('Shopify Admin API returned GraphQL errors');
    return body.data as T;
  }

  async getProducts(shop: string, accessToken: string, cursor?: string) {
    return this.adminGraphql(shop, accessToken, `#graphql
      query Products($cursor: String) {
        products(first: 100, after: $cursor) {
          nodes { id title handle }
          pageInfo { hasNextPage endCursor }
        }
      }`, {cursor});
  }

  async getShop(shop: string, accessToken: string) {
    return this.adminGraphql<{shop: {id: string; name: string}}>(shop, accessToken, `#graphql
      query ShopIdentity {
        shop { id name }
      }`);
  }

  async getOrders(shop: string, accessToken: string, cursor?: string) {
    return this.adminGraphql<{
      orders: {
        nodes: Array<{
          id: string;
          name: string;
          displayFulfillmentStatus: string;
          customer: {id: string; email: string | null; firstName: string | null; lastName: string | null} | null;
          lineItems: {nodes: Array<{quantity: number; product: {id: string; title: string} | null}>};
          fulfillments: Array<{createdAt: string}>;
        }>;
        pageInfo: {hasNextPage: boolean; endCursor: string | null};
      };
    }>(shop, accessToken, `#graphql
      query Orders($cursor: String) {
        orders(first: 100, after: $cursor) {
          nodes {
            id name displayFulfillmentStatus
            customer { id email firstName lastName }
            lineItems(first: 100) { nodes { quantity product { id title } } }
            fulfillments { createdAt }
          }
          pageInfo { hasNextPage endCursor }
        }
      }`, {cursor});
  }
}
