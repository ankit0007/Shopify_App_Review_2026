import {useLoaderData} from 'react-router';
import {BlockStack, Card, EmptyState, InlineStack, Page, Text} from '@shopify/polaris';
import {authenticate} from '../shopify.server';
import {db} from '../db.server';

export async function loader({request}: {request: Request}) {
  const {session} = await authenticate.admin(request);
  const shop = await db.shop.findUnique({where: {shopDomain: session.shop}, select: {id: true}});
  const requests = shop ? await db.reviewRequest.findMany({
    where: {shopId: shop.id},
    orderBy: {createdAt: 'desc'},
    take: 100,
    select: {
      id: true,
      status: true,
      scheduledAt: true,
      sentAt: true,
      reminderCount: true,
      customer: {select: {displayName: true}},
      product: {select: {title: true}},
    },
  }) : [];
  return {requests};
}

export default function ReviewRequests() {
  const {requests} = useLoaderData<typeof loader>();
  return (
    <Page title="Review requests">
      {requests.length === 0 ? (
        <EmptyState heading="No review requests yet" image="">
          Requests are created after a synchronized fulfilled order when automatic requests are enabled.
        </EmptyState>
      ) : (
        <BlockStack gap="300">
          {requests.map((request) => (
            <Card key={request.id}>
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">{request.product?.title ?? 'Product'}</Text>
                  <Text as="span" fontWeight="semibold">{request.status}</Text>
                </InlineStack>
                <Text as="p">{request.customer?.displayName ?? 'Customer'} · reminders {request.reminderCount}</Text>
                <Text as="p">Scheduled: {request.scheduledAt ? new Date(request.scheduledAt).toLocaleString() : 'Not scheduled'} · Sent: {request.sentAt ? new Date(request.sentAt).toLocaleString() : 'Not sent'}</Text>
              </BlockStack>
            </Card>
          ))}
        </BlockStack>
      )}
    </Page>
  );
}
