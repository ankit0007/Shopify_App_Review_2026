import {Form, useLoaderData} from 'react-router';
import {BlockStack, Card, EmptyState, InlineStack, Page, Text} from '@shopify/polaris';
import {authenticate} from '../shopify.server';
import {db} from '../db.server';
import {deliveryLabel} from '../modules/email/delivery-state';

export async function loader({request}: {request: Request}) {
  const {session} = await authenticate.admin(request);
  const url = new URL(request.url);
  const allowedStatuses = ['SCHEDULED', 'SENT', 'FAILED', 'EXPIRED', 'SUBMITTED', 'CANCELLED'] as const;
  const requestedStatus = url.searchParams.get('status');
  const status = allowedStatuses.find((value) => value === requestedStatus);
  const search = url.searchParams.get('q')?.trim();
  const shop = await db.shop.findUnique({where: {shopDomain: session.shop}, select: {id: true}});
  const requests = shop ? await db.reviewRequest.findMany({
    where: {
      shopId: shop.id,
      ...(status ? {status} : {}),
      ...(search ? {OR: [
        {product: {title: {contains: search, mode: 'insensitive'}}},
        {customer: {displayName: {contains: search, mode: 'insensitive'}}},
        {order: {orderNumber: {contains: search}}},
      ]} : {}),
    },
    orderBy: {createdAt: 'desc'},
    take: 50,
    select: {
      id: true,
      status: true,
      createdAt: true,
      scheduledAt: true,
      sentAt: true,
      expiresAt: true,
      reminderCount: true,
      lastError: true,
      customer: {select: {displayName: true}},
      product: {select: {title: true}},
      order: {select: {orderNumber: true}},
    },
  }) : [];
  return {
    filters: {status: status ?? '', search: search ?? ''},
    requests: requests.map((reviewRequest) => ({
      ...reviewRequest,
      delivery: deliveryLabel(reviewRequest.status, reviewRequest.reminderCount),
    })),
  };
}

export default function ReviewRequests() {
  const {requests, filters} = useLoaderData<typeof loader>();
  return (
    <Page title="Review requests">
      <Form method="get">
        <InlineStack gap="200">
          <input name="q" defaultValue={filters.search} placeholder="Search product or customer" />
          <select name="status" defaultValue={filters.status} aria-label="Filter by status">
            <option value="">All statuses</option>
            {['SCHEDULED', 'SENT', 'FAILED', 'EXPIRED', 'SUBMITTED', 'CANCELLED'].map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <button type="submit">Filter</button>
        </InlineStack>
      </Form>
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
                  <Text as="span" fontWeight="semibold">{request.delivery}</Text>
                </InlineStack>
                <Text as="p">{request.customer?.displayName ?? 'Customer'} · order {request.order?.orderNumber ?? 'unavailable'} · reminders {request.reminderCount}</Text>
                <Text as="p">Created {new Date(request.createdAt).toLocaleString()} · scheduled {request.scheduledAt ? new Date(request.scheduledAt).toLocaleString() : 'not scheduled'}</Text>
                <Text as="p">Accepted {request.sentAt ? new Date(request.sentAt).toLocaleString() : 'not accepted'} · expires {request.expiresAt ? new Date(request.expiresAt).toLocaleString() : 'not set'}</Text>
                {request.lastError ? <Text as="p">Failure: {request.lastError}</Text> : null}
              </BlockStack>
            </Card>
          ))}
        </BlockStack>
      )}
    </Page>
  );
}
