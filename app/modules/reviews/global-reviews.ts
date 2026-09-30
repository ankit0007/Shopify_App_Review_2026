const PRODUCT_HANDLE = /^[a-z0-9][a-z0-9-]*$/i;

export function publicShopDomain(shop: string | null) {
  if (!shop) return {ok: false as const, code: 'MISSING_SHOP' as const};
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop)) return {ok: false as const, code: 'INVALID_SHOP' as const};
  return {ok: true as const, shop};
}

export function globalApprovedWhere(shopId: string) {
  return {shopId, status: 'APPROVED' as const, deletedAt: null};
}

export function isPublicShopReview(review: {shopId: string; status: string; deletedAt: Date | string | null}, shopId: string) {
  return review.shopId === shopId && review.status === 'APPROVED' && review.deletedAt == null;
}

export function publicProductLink(product: {title?: string | null; handle?: string | null} | null | undefined) {
  const title = product?.title?.trim();
  if (!title) return null;
  const handle = product?.handle && PRODUCT_HANDLE.test(product.handle) ? product.handle : null;
  return {title, url: handle ? `/products/${handle}` : null};
}

export function handlesByProductId(nodes: Array<{id?: string | null; handle?: string | null} | null> | null | undefined) {
  const handles = new Map<string, string>();
  for (const node of nodes ?? []) {
    if (!node?.id || !node.handle) continue;
    const id = node.id.split('/').pop() ?? '';
    if (/^\d{1,20}$/.test(id) && /^[a-z0-9][a-z0-9-]*$/i.test(node.handle)) handles.set(id, node.handle);
  }
  return handles;
}

export function pageSlice<T>(rows: T[], limit: number) {
  const hasMore = rows.length > limit;
  return {items: hasMore ? rows.slice(0, limit) : rows, hasMore};
}
