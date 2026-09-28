import {db} from '../db.server';
import {hashToken} from '../lib/tokens.server';

export function headers() {
  return {'X-Robots-Tag': 'noindex, nofollow, noarchive'};
}

export async function loader({params}: {params: {token?: string}}) {
  const token = params.token;
  if (!token) throw new Response('Not found', {status: 404});
  const reviewRequest = await db.reviewRequest.findUnique({
    where: {tokenHash: hashToken(token)},
    select: {shopId: true, customerId: true},
  });
  if (!reviewRequest?.customerId) throw new Response('This unsubscribe link is not valid.', {status: 410});
  await db.consent.create({
    data: {
      shopId: reviewRequest.shopId,
      customerId: reviewRequest.customerId,
      purpose: 'review_request',
      granted: false,
      source: 'unsubscribe',
    },
  });
  await db.reviewRequest.updateMany({
    where: {
      shopId: reviewRequest.shopId,
      customerId: reviewRequest.customerId,
      status: {in: ['SCHEDULED', 'SENDING']},
    },
    data: {status: 'CANCELLED', lastError: 'Customer opted out'},
  });
  return {unsubscribed: true};
}

export default function Unsubscribe() {
  return (
    <main style={{maxWidth: 480, margin: '4rem auto', fontFamily: 'sans-serif'}}>
      <h1>Unsubscribed</h1>
      <p>You will not receive more review request emails for this store.</p>
    </main>
  );
}
