import {Form, useActionData, useLoaderData} from 'react-router';
import {Page, Card, FormLayout, TextField, Select, Button, Banner} from '@shopify/polaris';
import {db} from '../db.server';
import {hashToken} from '../lib/tokens.server';
import {fail} from '../lib/api.server';
import {submitReview} from '../modules/reviews/review.service.server';
import {consumeRateLimit, requestClientKey} from '../lib/rate-limit.server';
import {isSameOrigin} from '../lib/csrf.server';

export function headers() {
  return {'X-Robots-Tag': 'noindex, nofollow, noarchive'};
}

export async function loader({params}: {params: {token?: string}}) {
  const token = params.token;
  if (!token) throw new Response('Not found', {status: 404});
  const request = await db.reviewRequest.findUnique({
    where: {tokenHash: hashToken(token)},
    include: {product: true},
  });
  if (!request || request.expiresAt && request.expiresAt < new Date() || ['CANCELLED', 'SUBMITTED'].includes(request.status)) {
    throw new Response('This review link has expired.', {status: 410});
  }
  return {productTitle: request.product?.title ?? 'your purchase', token};
}

export async function action({request, params}: {request: Request; params: {token?: string}}) {
  if (!isSameOrigin(request)) return fail('CSRF_REJECTED', 'Request origin is not allowed.', 403);
  const rate = consumeRateLimit(`review-submit:${requestClientKey(request)}`, 10, 60 * 60_000);
  if (!rate.allowed) return fail('RATE_LIMITED', 'Too many submissions. Try again later.', 429);
  const token = params.token;
  if (!token) return fail('INVALID_TOKEN', 'Review link is invalid.', 404);
  const reviewRequest = await db.reviewRequest.findUnique({
    where: {tokenHash: hashToken(token)},
  });
  if (!reviewRequest || !reviewRequest.productId || reviewRequest.expiresAt && reviewRequest.expiresAt < new Date() || ['CANCELLED', 'SUBMITTED'].includes(reviewRequest.status)) {
    return fail('EXPIRED_TOKEN', 'This review link has expired.', 410);
  }
  const formData = await request.formData();
  try {
    await submitReview({
      shopId: reviewRequest.shopId,
      reviewRequestId: reviewRequest.id,
      productId: reviewRequest.productId!,
      orderId: reviewRequest.orderId ?? undefined,
      customerId: reviewRequest.customerId ?? undefined,
      data: {
        rating: Number(formData.get('rating')),
        title: String(formData.get('title') ?? ''),
        body: String(formData.get('body') ?? ''),
        displayName: String(formData.get('displayName') ?? ''),
      },
    });
    return {success: true};
  } catch {
    return fail('INVALID_REVIEW', 'Please check your review and try again.');
  }
}

export default function ReviewPage() {
  const {productTitle} = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  return (
    <Page title={`Review ${productTitle}`}>
      {result && 'success' in result && result.success ? <Banner tone="success">Thank you for sharing your review.</Banner> : null}
      <Card>
        <Form method="post">
          <FormLayout>
            <Select label="Rating" name="rating" options={[1, 2, 3, 4, 5].map((value) => ({label: `${value} star${value === 1 ? '' : 's'}`, value: String(value)}))} />
            <TextField label="Title" name="title" autoComplete="off" />
            <TextField label="Review" name="body" multiline={5} autoComplete="off" />
            <TextField label="Display name" name="displayName" autoComplete="name" />
            <Button submit variant="primary">Submit review</Button>
          </FormLayout>
        </Form>
      </Card>
    </Page>
  );
}
