import { useState } from 'react';
import { useFetcher, useLoaderData } from 'react-router';
import { reviewLinkState, sameOrderRequest } from '../modules/reviews/request-access';
import { hashToken } from '../lib/tokens.server';
import { db } from '../db.server';
import { consumeRateLimit, requestClientKey } from '../lib/rate-limit.server';
import { isSameOrigin } from '../lib/csrf.server';
import { submitReview } from '../modules/reviews/review.service.server';
import { publicReviewSubmissionSchema } from '../modules/reviews/review.schema';

export function headers() {
  return { 'X-Robots-Tag': 'noindex, nofollow, noarchive' };
}

const STAR_PATH = 'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z';

async function anchorForToken(token: string) {
  return db.reviewRequest.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      shopId: true,
      orderId: true,
      customerId: true,
      productId: true,
      status: true,
      expiresAt: true,
      order: { select: { orderNumber: true } },
      customer: { select: { displayName: true } },
    },
  });
}

export async function loader({ request, params }: { request: Request; params: { token?: string } }) {
  const rate = consumeRateLimit(`review-request:${requestClientKey(request)}`, 60, 60_000);
  if (!rate.allowed) return { state: 'invalid' as const, message: 'Please wait a moment and try again.', products: [], orderNumber: '', customerName: '' };
  const token = params.token;
  if (!token) return { state: 'invalid' as const, message: 'This review link is not available.', products: [], orderNumber: '', customerName: '' };
  const anchor = await anchorForToken(token);
  const state = reviewLinkState(anchor);
  if (!anchor || state !== 'ready') {
    return {
      state,
      message: state === 'expired' ? 'This review link has expired.' : 'This review link is not available.',
      products: [],
      orderNumber: '',
      customerName: '',
    };
  }
  const requests = anchor.orderId ? await db.reviewRequest.findMany({
    where: { shopId: anchor.shopId, orderId: anchor.orderId, customerId: anchor.customerId, status: { notIn: ['CANCELLED', 'EXPIRED'] } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, status: true, product: { select: { shopifyProductId: true, title: true, imageUrl: true } } },
  }) : await db.reviewRequest.findMany({
    where: { id: anchor.id },
    select: { id: true, status: true, product: { select: { shopifyProductId: true, title: true, imageUrl: true } } },
  });
  await db.reviewRequest.updateMany({
    where: { id: { in: requests.map((item) => item.id) }, status: 'SENT' },
    data: { status: 'OPENED' },
  });
  return {
    state: 'ready' as const,
    message: '',
    orderNumber: anchor.order?.orderNumber ?? '',
    customerName: anchor.customer?.displayName ?? '',
    products: requests.flatMap((item) => item.product ? [{
      id: item.product.shopifyProductId,
      title: item.product.title,
      imageUrl: item.product.imageUrl,
      submitted: item.status === 'SUBMITTED',
    }] : []),
  };
}

export async function action({ request, params }: { request: Request; params: { token?: string } }) {
  if (!isSameOrigin(request)) return { ok: false, message: 'Request could not be verified.' };
  const rate = consumeRateLimit(`review-submit:${requestClientKey(request)}`, 10, 60 * 60_000);
  if (!rate.allowed) return { ok: false, message: 'Too many submissions. Try again later.' };
  const token = params.token;
  if (!token) return { ok: false, message: 'This review link is not available.' };
  const anchor = await anchorForToken(token);
  if (!anchor || reviewLinkState(anchor) !== 'ready') return { ok: false, message: 'This review link is not available.' };
  const form = await request.formData();
  const productId = String(form.get('productId') ?? '');
  if (!/^\d{1,20}$/.test(productId)) return { ok: false, message: 'Choose a product from this order.' };
  const target = await db.reviewRequest.findFirst({
    where: {
      shopId: anchor.shopId,
      ...(anchor.orderId ? { orderId: anchor.orderId, customerId: anchor.customerId } : { id: anchor.id }),
      product: { shopifyProductId: productId, shopId: anchor.shopId },
      status: { notIn: ['CANCELLED', 'EXPIRED'] },
    },
    select: { id: true, shopId: true, orderId: true, customerId: true, productId: true, status: true },
  });
  if (!target?.productId || !sameOrderRequest(anchor, target) && target?.id !== anchor.id) {
    return { ok: false, message: 'That product is not part of this review link.' };
  }
  if (target.orderId) {
    const purchased = await db.orderItem.findFirst({
      where: { orderId: target.orderId, productId: target.productId, quantity: { gt: 0 }, product: { shopId: anchor.shopId } },
      select: { id: true },
    });
    if (!purchased) return { ok: false, message: 'That product is not part of this review link.' };
  }
  if (target.status === 'SUBMITTED') return { ok: true, productId, submitted: true, message: 'Review submitted. Thank you for sharing your experience.' };
  const orderName = anchor.customer?.displayName?.replace(/[\r\n]+/g, ' ').trim() || 'Customer';
  const parsed = publicReviewSubmissionSchema.safeParse({
    rating: form.get('rating'),
    title: String(form.get('title') ?? ''),
    body: String(form.get('body') ?? ''),
    displayName: orderName,
  });
  if (!parsed.success) return { ok: false, productId, message: 'Enter a rating and a review of at least 10 characters.' };
  try {
    const review = await submitReview({
      shopId: target.shopId,
      reviewRequestId: target.id,
      productId: target.productId,
      orderId: target.orderId ?? undefined,
      customerId: target.customerId ?? undefined,
      data: parsed.data,
    });
    const pending = review.status !== 'APPROVED';
    return {
      ok: true,
      productId,
      submitted: true,
      message: pending
        ? 'Thank you! Your review has been submitted and is awaiting approval.'
        : 'Thank you. Your review is now published.',
    };
  } catch {
    return { ok: false, productId, message: 'This product could not be reviewed again.' };
  }
}

export default function ReviewRequestPage() {
  const data = useLoaderData<typeof loader>();
  return (
    <main className="request-page">
      <header>
        <h1>Review your recent purchases</h1>
        {data.orderNumber ? <p>Order #{data.orderNumber}</p> : null}
        <p>We&apos;d love to hear what you think</p>
      </header>
      {data.state !== 'ready' ? <p className="request-page__note" role="alert">{data.message}</p> : null}
      <div className="request-page__list">
        {data.products.map((product) => <ProductReview key={product.id} product={product} customerName={data.customerName} />)}
      </div>
      <style>{PAGE_CSS}</style>
    </main>
  );
}

function ProductReview({ product, customerName }: { product: { id: string; title: string; imageUrl: string | null; submitted: boolean }; customerName: string }) {
  const fetcher = useFetcher<typeof action>();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const done = product.submitted || fetcher.data?.submitted === true;
  const shown = hover || rating;
  return (
    <article className="request-card">
      <div className="request-card__product">
        {product.imageUrl ? <img src={product.imageUrl} alt="" width="72" height="72" /> : <span className="request-card__image" aria-hidden="true" />}
        <h2>{product.title}</h2>
      </div>
      {done ? (
        <p className="request-page__note" role="status">
          {fetcher.data?.submitted && fetcher.data.message
            ? fetcher.data.message
            : 'Review submitted. Thank you for sharing your experience.'}
        </p>
      ) : (
        <fetcher.Form method="post">
          <input type="hidden" name="productId" value={product.id} />
          <input type="hidden" name="rating" value={rating || ''} />
          <fieldset>
            <legend>Your rating</legend>
            <div role="radiogroup" aria-label={`Rating for ${product.title}`}>
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={rating === value}
                  aria-label={`${value} ${value === 1 ? 'star' : 'stars'}`}
                  onMouseEnter={() => setHover(value)}
                  onMouseLeave={() => setHover(0)}
                  onClick={() => setRating(value)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d={STAR_PATH} fill={value <= shown ? '#F5B301' : '#D9DDE3'} /></svg>
                </button>
              ))}
            </div>
            <p>{rating ? `${rating} ${rating === 1 ? 'star' : 'stars'} selected` : 'No rating selected'}</p>
          </fieldset>
          <label htmlFor={`title-${product.id}`}>Review title <span>Optional</span></label>
          <input id={`title-${product.id}`} name="title" maxLength={100} />
          <label htmlFor={`body-${product.id}`}>Your review</label>
          <textarea id={`body-${product.id}`} name="body" required minLength={10} maxLength={5000} rows={4} />
          <p className="request-card__name">Reviewing as {customerName || 'Customer'}</p>
          {fetcher.data && 'message' in fetcher.data && !fetcher.data.ok ? <p className="request-page__error" role="alert">{fetcher.data.message}</p> : null}
          <button type="submit" disabled={fetcher.state !== 'idle'}>{fetcher.state === 'idle' ? 'Submit review' : 'Submitting…'}</button>
        </fetcher.Form>
      )}
    </article>
  );
}

const PAGE_CSS = `
.request-page { max-width: 760px; margin: 0 auto; padding: 32px 16px 64px; color: #202223; font: 16px/1.5 inherit; }
.request-page h1 { margin: 0 0 8px; font-size: 32px; }
.request-page header p { margin: 0 0 24px; color: #6d7175; }
.request-page__list { display: grid; gap: 16px; }
.request-card { border: 1px solid #e3e3e3; border-radius: 16px; padding: 16px; display: grid; gap: 12px; }
.request-card__product { display: flex; gap: 12px; align-items: center; }
.request-card img, .request-card__image { width: 72px; height: 72px; border-radius: 12px; object-fit: cover; background: #f1f2f3; flex: 0 0 auto; }
.request-card h2 { margin: 0; font-size: 18px; overflow-wrap: anywhere; }
.request-card fieldset { border: 0; margin: 0; padding: 0; }
.request-card [role="radiogroup"] { display: flex; gap: 4px; }
.request-card button[role="radio"] { border: 0; background: transparent; padding: 4px; border-radius: 8px; cursor: pointer; }
.request-card button[role="radio"] svg { width: 22px; height: 22px; display: block; }
.request-card input, .request-card textarea { width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid #c9cccf; border-radius: 8px; font: inherit; }
.request-card label span { color: #6d7175; font-weight: 500; }
.request-card__name { margin: 0; color: #202223; font-weight: 600; }
.request-card button[type="submit"] { border: 0; border-radius: 8px; background: #111; color: #fff; font-weight: 700; padding: 12px 16px; cursor: pointer; }
.request-page__note { background: #f1f8f5; border-radius: 12px; padding: 12px; }
.request-page__error { color: #8e1f0b; margin: 0; }
.request-card :focus-visible { outline: 2px solid #005bd3; outline-offset: 2px; }
@media (max-width: 390px) {
  .request-page { padding-inline: 12px; }
  .request-card__product { align-items: flex-start; }
  .request-card button[type="submit"] { width: 100%; }
  .request-card button[role="radio"] svg { width: 20px; height: 20px; }
}
`;
