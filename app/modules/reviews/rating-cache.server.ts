import type {PublicRating} from './rating';

const TTL_MS = 60_000;
const cache = new Map<string, {expires: number; value: PublicRating}>();

function key(shopDomain: string, productId: string) {
  return `${shopDomain}\n${productId}`;
}

export function readRatingCache(shopDomain: string, productId: string, now = Date.now()) {
  const entry = cache.get(key(shopDomain, productId));
  if (!entry || entry.expires <= now) {
    if (entry) cache.delete(key(shopDomain, productId));
    return undefined;
  }
  return entry.value;
}

export function writeRatingCache(shopDomain: string, productId: string, value: PublicRating, now = Date.now()) {
  cache.set(key(shopDomain, productId), {expires: now + TTL_MS, value});
}

export function invalidateRatingCache(shopDomain: string, productId?: string) {
  if (productId) {
    cache.delete(key(shopDomain, productId));
    return;
  }
  for (const entry of cache.keys()) {
    if (entry.startsWith(`${shopDomain}\n`)) cache.delete(entry);
  }
}
