import {authenticate} from '../shopify.server';
import {consumeRateLimit} from '../lib/rate-limit.server';
import {adminReviewRequestAllowed} from '../modules/reviews/admin-review';
import {searchShopProducts} from '../modules/reviews/admin-review.server';

export async function loader({request}: {request: Request}) {
  const {session, admin} = await authenticate.admin(request);
  if (!adminReviewRequestAllowed(request)) {
    return Response.json({products: [], error: 'Request could not be verified.'}, {status: 403});
  }
  const rate = consumeRateLimit(`admin-product-search:${session.shop}`, 30, 60_000);
  if (!rate.allowed) {
    return Response.json({products: [], error: 'Too many searches. Please wait a moment.'}, {status: 429});
  }
  const term = new URL(request.url).searchParams.get('q') ?? '';
  try {
    const products = await searchShopProducts(admin, term);
    return Response.json({products});
  } catch {
    return Response.json({products: [], error: 'Products could not be loaded. Please try again.'}, {status: 500});
  }
}
