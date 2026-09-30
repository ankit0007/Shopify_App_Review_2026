const PRODUCT_HANDLE = /^[a-z0-9][a-z0-9-]*$/;
const NUMERIC_ID = /^\d{1,20}$/;
const PRODUCT_GID = /^gid:\/\/shopify\/Product\/(\d{1,20})$/;

export type InsertionChoice = 'after-title' | 'before-price' | 'in-info' | 'skip';

export function productHandleFromHref(href: string | null | undefined) {
  if (!href) return null;
  const trimmed = href.trim();
  if (!trimmed || /^(javascript|data):/i.test(trimmed)) return null;
  let path = trimmed;
  try {
    path = new URL(trimmed, 'https://store.example').pathname;
  } catch {
    return null;
  }
  const match = path.match(/\/products\/([^/]+)/i);
  if (!match?.[1]) return null;
  let handle = match[1];
  try {
    handle = decodeURIComponent(handle);
  } catch {
    return null;
  }
  handle = handle.toLowerCase();
  return PRODUCT_HANDLE.test(handle) ? handle : null;
}

export function numericProductId(value: string | null | undefined) {
  if (!value) return null;
  const token = value.trim();
  const gid = PRODUCT_GID.exec(token);
  const id = gid?.[1] ?? token;
  return NUMERIC_ID.test(id) ? id : null;
}

export function chunkIds<T>(values: T[], size = 50) {
  const chunks: T[][] = [];
  const limit = Math.max(1, size);
  for (let index = 0; index < values.length; index += limit) chunks.push(values.slice(index, index + limit));
  return chunks;
}

export function idsToRequest(ids: string[], cached: ReadonlySet<string>) {
  const unique: string[] = [];
  for (const value of ids) {
    const id = numericProductId(value);
    if (!id || cached.has(id) || unique.includes(id)) continue;
    unique.push(id);
  }
  return unique;
}

export function chooseInsertion(input: {
  hasTitle: boolean;
  titleInMedia: boolean;
  hasPrice: boolean;
  priceInMedia: boolean;
  hasInfo: boolean;
  infoInMedia: boolean;
}): InsertionChoice {
  if (input.hasTitle && !input.titleInMedia) return 'after-title';
  if (input.hasPrice && !input.priceInMedia) return 'before-price';
  if (input.hasInfo && !input.infoInMedia) return 'in-info';
  return 'skip';
}

export function productPageEmbedSuppressed(pageType: string, productId: string, sectionProductIds: ReadonlySet<string>) {
  return pageType === 'product' && sectionProductIds.has(productId);
}

export function shouldInjectCard(input: {
  mounted: boolean;
  alreadyHasRating: boolean;
  productId: string | null;
  pageType: string;
  sectionProductIds: ReadonlySet<string>;
}) {
  if (input.mounted || input.alreadyHasRating) return false;
  if (input.productId && productPageEmbedSuppressed(input.pageType, input.productId, input.sectionProductIds)) return false;
  return true;
}

export function mutationNeedsScan(addedKinds: Array<'rating' | 'other' | 'text'>) {
  return addedKinds.includes('other');
}

export function rememberMounted(mounted: Set<string>, productId: string) {
  if (mounted.has(productId)) return false;
  mounted.add(productId);
  return true;
}

export function formatReviewCount(count: number, format: 'words' | 'compact') {
  if (format === 'compact') return `(${count})`;
  return `${count} ${count === 1 ? 'review' : 'reviews'}`;
}
