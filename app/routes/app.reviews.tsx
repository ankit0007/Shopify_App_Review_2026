import {Form, useLoaderData} from 'react-router';
import {BlockStack, Card, EmptyState, InlineStack, Page, Text} from '@shopify/polaris';
import {authenticate} from '../shopify.server';
import {db} from '../db.server';
import {moderateReview} from '../modules/reviews/moderation.service.server';

export async function loader({request}: {request: Request}) {
  const {session} = await authenticate.admin(request);
  const shop = await db.shop.findUnique({where: {shopDomain: session.shop}, select: {id: true}});
  const reviews = shop
    ? await db.review.findMany({
      where: {shopId: shop.id, deletedAt: null},
      orderBy: {submittedAt: 'desc'},
      take: 50,
      select: {
        id: true,
        rating: true,
        body: true,
        displayName: true,
        status: true,
        product: {select: {title: true}},
      },
    })
    : [];
  return {reviews};
}

export async function action({request}: {request: Request}) {
  const {session} = await authenticate.admin(request);
  const shop = await db.shop.findUnique({where: {shopDomain: session.shop}, select: {id: true}});
  const form = await request.formData();
  const reviewId = String(form.get('reviewId') ?? '');
  const decision = form.get('decision');
  if (shop && reviewId && (decision === 'APPROVE' || decision === 'REJECT')) {
    await moderateReview({shopId: shop.id, reviewId, action: decision});
  }
  return null;
}

function Stars({rating}: {rating: number}) {
  return (
    <span aria-label={`${rating} out of 5 stars`} style={{display: 'inline-flex', gap: 2, fontSize: 22, lineHeight: 1}}>
      {[1, 2, 3, 4, 5].map((value) => (
        <span key={value} style={{color: value <= rating ? '#f5b301' : '#d1d5db'}}>★</span>
      ))}
    </span>
  );
}

const statusColor: Record<string, {color: string; background: string}> = {
  PENDING: {color: '#92400e', background: '#fef3c7'},
  APPROVED: {color: '#166534', background: '#dcfce7'},
  REJECTED: {color: '#991b1b', background: '#fee2e2'},
};

export default function Reviews() {
  const {reviews} = useLoaderData<typeof loader>();
  return (
    <Page title="Reviews">
      {reviews.length === 0 ? (
        <EmptyState heading="No reviews yet" image="" fullWidth>
          Customer reviews from the product page will appear here. Approve a review to show it on the storefront.
        </EmptyState>
      ) : (
        <BlockStack gap="300">
          {reviews.map((review) => {
            const tone = statusColor[review.status] ?? {color: '#374151', background: '#f3f4f6'};
            return (
              <Card key={review.id}>
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h2" variant="headingMd">{review.product.title}</Text>
                    <span style={{padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, color: tone.color, background: tone.background}}>
                      {review.status}
                    </span>
                  </InlineStack>
                  <Stars rating={review.rating} />
                  <Text as="p" fontWeight="semibold">{review.displayName || 'Customer'}</Text>
                  <Text as="p">{review.body}</Text>
                  {review.status === 'PENDING' ? (
                    <Form method="post">
                      <input type="hidden" name="reviewId" value={review.id} />
                      <InlineStack gap="200">
                        <button type="submit" name="decision" value="APPROVE" style={approveButton}>Approve</button>
                        <button type="submit" name="decision" value="REJECT" style={rejectButton}>Disapprove</button>
                      </InlineStack>
                    </Form>
                  ) : null}
                </BlockStack>
              </Card>
            );
          })}
        </BlockStack>
      )}
    </Page>
  );
}

const approveButton = {
  padding: '8px 16px',
  border: 0,
  borderRadius: 8,
  background: '#166534',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer',
};

const rejectButton = {
  padding: '8px 16px',
  border: '1px solid #991b1b',
  borderRadius: 8,
  background: '#fff',
  color: '#991b1b',
  fontWeight: 700,
  cursor: 'pointer',
};
