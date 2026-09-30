import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fail} from '../lib/api.server';
import {verifyAppProxySignature} from '../lib/shopify-signatures.server';
import {config} from '../config.server';
import {consumeRateLimit, requestClientKey} from '../lib/rate-limit.server';
import {publicShopDomain} from '../modules/reviews/global-reviews';

const ASSETS: Record<string, {file: string; type: string}> = {
  'all-reviews.js': {file: path.join('app', 'storefront', 'all-reviews.js'), type: 'text/javascript; charset=utf-8'},
  'review-widgets.css': {file: path.join('extensions', 'review-widgets', 'assets', 'review-widgets.css'), type: 'text/css; charset=utf-8'},
};

export function loader({params, request}: {params: {file?: string}; request: Request}) {
  const rate = consumeRateLimit(`public-asset:${requestClientKey(request)}`, 120, 60_000);
  if (!rate.allowed) return fail('RATE_LIMITED', 'Too many requests', 429);
  const asset = params.file ? ASSETS[params.file] : undefined;
  if (!asset) return new Response('Not found', {status: 404});
  const url = new URL(request.url);
  const shop = publicShopDomain(url.searchParams.get('shop'));
  if (!shop.ok) return fail(shop.code, shop.code === 'MISSING_SHOP' ? 'Shop context is required' : 'Shop context is invalid');
  if (!verifyAppProxySignature(url, config.SHOPIFY_API_SECRET)) return fail('INVALID_SIGNATURE', 'Request signature is invalid', 401);
  const full = path.resolve(asset.file);
  const allowedRoot = path.resolve(asset.file.startsWith(`app${path.sep}`) || asset.file.startsWith('app/') ? 'app' : 'extensions');
  if (!full.startsWith(`${allowedRoot}${path.sep}`)) return new Response('Not found', {status: 404});
  try {
    return new Response(readFileSync(full), {
      headers: {'Content-Type': asset.type, 'Cache-Control': 'public, max-age=60', 'X-Content-Type-Options': 'nosniff'},
    });
  } catch {
    return new Response('Not found', {status: 404});
  }
}
