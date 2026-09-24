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
}
