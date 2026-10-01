import {config} from '../../config.server';
import {db} from '../../db.server';

type ListedProduct = {id: string; shopifyProductId: string; title: string; imageUrl: string | null};

export async function attachProductImages(shopDomain: string, products: ListedProduct[]) {
  const missing = products.filter((product) => !product.imageUrl?.startsWith('https://') && /^\d{1,20}$/.test(product.shopifyProductId));
  if (!missing.length) return products;
  const session = await db.session.findFirst({
    where: {shop: shopDomain, isOnline: false},
    select: {accessToken: true},
  });
  if (!session?.accessToken) return products;
  try {
    const response = await fetch(`https://${shopDomain}/admin/api/${config.SHOPIFY_API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'X-Shopify-Access-Token': session.accessToken},
      body: JSON.stringify({
        query: 'query ProductImages($ids: [ID!]!) { nodes(ids: $ids) { ... on Product { id featuredImage { url } } } }',
        variables: {ids: missing.map((product) => `gid://shopify/Product/${product.shopifyProductId}`)},
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return products;
    const payload = await response.json() as {data?: {nodes?: Array<{id?: string; featuredImage?: {url?: string | null} | null} | null>}};
    const images = new Map<string, string>();
    for (const node of payload.data?.nodes ?? []) {
      const id = node?.id?.split('/').at(-1);
      const url = node?.featuredImage?.url;
      if (id && url?.startsWith('https://')) images.set(id, url);
    }
    await Promise.all(products.flatMap((product) => {
      const imageUrl = images.get(product.shopifyProductId);
      if (!imageUrl) return [];
      product.imageUrl = imageUrl;
      return [db.product.update({where: {id: product.id}, data: {imageUrl}})];
    }));
  } catch {
    return products;
  }
  return products;
}
