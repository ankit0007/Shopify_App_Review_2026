import {config} from '../config.server';
import {fail, ok} from '../lib/api.server';
import {consumeRateLimit, requestClientKey} from '../lib/rate-limit.server';
import {validateRatingRequest} from '../modules/reviews/rating-request';
import {loadPublicRatings} from '../modules/reviews/rating.server';

export async function loader({request}: {request: Request}) {
  const rate = consumeRateLimit(`public-ratings:${requestClientKey(request)}`, 60, 60_000);
  if (!rate.allowed) {
    return Response.json({success: false, error: {code: 'RATE_LIMITED', message: 'Too many requests'}}, {
      status: 429,
      headers: {'Retry-After': String(rate.retryAfterSeconds)},
    });
  }
  const validation = validateRatingRequest(new URL(request.url), config.SHOPIFY_API_SECRET);
  if (!validation.ok) return fail(validation.code, validation.message, validation.status);
  const ratings = await loadPublicRatings(validation.shopDomain, validation.productIds);
  return ok({ratings}, {headers: {'Cache-Control': 'private, max-age=60'}});
}
