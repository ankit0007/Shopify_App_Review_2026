import {createHmac} from 'node:crypto';
import {verifyAppProxySignature} from '../../lib/shopify-signatures.server';
import {parseProductIds, MAX_RATING_QUERY_LENGTH} from './rating';

const SHOP_PATTERN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i;

export function validateRatingRequest(url: URL, secret: string) {
  if (url.search.length > MAX_RATING_QUERY_LENGTH) {
    return {ok: false as const, status: 413, code: 'QUERY_TOO_LARGE', message: 'Rating request is too large'};
  }
  const shopDomain = url.searchParams.get('shop');
  if (!shopDomain) return {ok: false as const, status: 400, code: 'MISSING_SHOP', message: 'Shop context is required'};
  if (!SHOP_PATTERN.test(shopDomain)) return {ok: false as const, status: 400, code: 'INVALID_SHOP', message: 'Shop context is invalid'};
  if (!verifyAppProxySignature(url, secret)) {
    return {ok: false as const, status: 401, code: 'INVALID_SIGNATURE', message: 'Request signature is invalid'};
  }
  const parsed = parseProductIds(url.searchParams.get('productIds'));
  if (!parsed.ok) {
    const message = parsed.code === 'TOO_MANY_PRODUCTS'
      ? 'Too many products were requested'
      : parsed.code === 'MISSING_PRODUCTS'
        ? 'At least one product is required'
        : 'A product id is invalid';
    return {ok: false as const, status: 400, code: parsed.code, message};
  }
  return {ok: true as const, shopDomain, productIds: parsed.ids};
}

export function signRatingUrl(url: URL, secret: string) {
  const pairs = [...url.searchParams.entries()]
    .filter(([key]) => key !== 'signature')
    .sort(([keyA, valueA], [keyB, valueB]) => {
      const left = `${keyA}=${valueA}`;
      const right = `${keyB}=${valueB}`;
      return left < right ? -1 : left > right ? 1 : 0;
    })
    .map(([key, value]) => `${key}=${value}`)
    .join('');
  url.searchParams.set('signature', createHmac('sha256', secret).update(pairs).digest('hex'));
  return url;
}
