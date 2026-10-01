import {Form, useLoaderData} from 'react-router';
import {BlockStack, Card, EmptyState, InlineStack, Page, Text} from '@shopify/polaris';
import {AdminListPagination} from '../components/admin-list-pagination';
import {authenticate} from '../shopify.server';
import {db} from '../db.server';
import {decryptData} from '../lib/encrypted-data.server';
import {maskEmail} from '../modules/email/delivery.server';
import {deliveryLabel} from '../modules/email/delivery-state';
import {ADMIN_PAGE_SIZE, adminPage, pageCount} from '../modules/admin/page';

export async function loader({request}: {request: Request}) {
  const {session} = await authenticate.admin(request);
  const url = new URL(request.url);
  const allowedStatuses = ['PENDING', 'SCHEDULED', 'SENT', 'OPENED', 'FAILED', 'EXPIRED', 'SUBMITTED', 'CANCELLED'] as const;
  const requestedStatus = url.searchParams.get('status');
  const status = allowedStatuses.find((value) => value === requestedStatus);
  const search = url.searchParams.get('q')?.trim();
  const page = adminPage(url.searchParams.get('page'));
  const shop = await db.shop.findUnique({where: {shopDomain: session.shop}, select: {id: true}});
  const where = {
    shopId: shop?.id ?? '',
    ...(status ? {status} : {}),
    ...(search ? {OR: [
      {product: {title: {contains: search, mode: 'insensitive' as const}}},
      {customer: {displayName: {contains: search, mode: 'insensitive' as const}}},
      {order: {orderNumber: {contains: search}}},
    ]} : {}),
  };
  const [total, requests] = shop ? await Promise.all([
    db.reviewRequest.count({where}),
    db.reviewRequest.findMany({
      where,
      orderBy: {createdAt: 'desc'},
      skip: (page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      select: {
        id: true,
        status: true,
        createdAt: true,
        scheduledAt: true,
        sentAt: true,
        expiresAt: true,
        reminderCount: true,
        lastError: true,
        customer: {select: {displayName: true, emailEncrypted: true, consents: {where: {purpose: 'review_request', granted: false}, select: {id: true}, take: 1}}},
        product: {select: {title: true}},
        order: {select: {orderNumber: true, items: {where: {fulfilledQuantity: {gt: 0}}, select: {id: true}}}},
      },
    }),
  ]) : [0, []];
  return {
    filters: {status: status ?? '', search: search ?? ''},
    page,
    pages: pageCount(total),
    total,
    requests: requests.map((reviewRequest) => ({
      ...reviewRequest,
      delivery: deliveryLabel(reviewRequest.status, reviewRequest.reminderCount),
      label: requestStatusLabel(reviewRequest.status),
      email: maskedRecipient(reviewRequest.customer?.emailEncrypted),
      productCount: reviewRequest.order?.items.length ?? (reviewRequest.product ? 1 : 0),
      unsubscribed: Boolean(reviewRequest.customer?.consents.length),
    })),
  };
}

function maskedRecipient(emailEncrypted: string | null | undefined) {
  if (!emailEncrypted) return 'unavailable';
  try {
    return maskEmail(decryptData(emailEncrypted));
  } catch {
    return 'unavailable';
  }
}

function requestStatusLabel(status: string) {
  if (status === 'SENT') return 'Sent';
  if (status === 'OPENED' || status === 'CLICKED') return 'Opened';
  if (status === 'SUBMITTED') return 'Completed';
  if (status === 'FAILED') return 'Failed';
  if (status === 'EXPIRED') return 'Expired';
  if (status === 'CANCELLED') return 'Cancelled';
  return 'Pending';
}

export default function ReviewRequests() {
  const {requests, filters, page, pages, total} = useLoaderData<typeof loader>();
  return (
    <Page title="Review requests">
      <Form method="get">
        <InlineStack gap="200">
          <input name="q" defaultValue={filters.search} placeholder="Search product or customer" />
          <select name="status" defaultValue={filters.status} aria-label="Filter by status">
            <option value="">All statuses</option>
            {['PENDING', 'SCHEDULED', 'SENT', 'OPENED', 'FAILED', 'EXPIRED', 'SUBMITTED', 'CANCELLED'].map((value) => <option key={value} value={value}>{requestStatusLabel(value)}</option>)}
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
                  <Text as="span" fontWeight="semibold">{request.label}</Text>
                </InlineStack>
                <Text as="p">Customer {request.customer?.displayName ?? 'Customer'}</Text>
                <Text as="p">Order {request.order?.orderNumber ?? 'unavailable'}</Text>
                <Text as="p">Product {request.product?.title ?? 'unavailable'}</Text>
                <Text as="p">Email {request.email}</Text>
                <Text as="p">Scheduled {request.scheduledAt ? new Date(request.scheduledAt).toLocaleString() : 'not scheduled'}</Text>
                <Text as="p">Sent {request.sentAt ? new Date(request.sentAt).toLocaleString() : 'not sent'}</Text>
                <Text as="p">Products {request.productCount}</Text>
                <Text as="p">Unsubscribed {request.unsubscribed ? 'yes' : 'no'}</Text>
                <Text as="p">Opened {request.status === 'OPENED' || request.status === 'CLICKED' || request.status === 'SUBMITTED' ? 'yes' : 'no'}</Text>
                <Text as="p">Reviewed {request.status === 'SUBMITTED' ? 'yes' : 'no'}</Text>
                <Text as="p">Delivery {request.delivery}</Text>
                {request.lastError ? <Text as="p">Failure: {request.lastError}</Text> : null}
              </BlockStack>
            </Card>
          ))}
        </BlockStack>
      )}
      <AdminListPagination
        page={page}
        pages={pages}
        total={total}
        noun="request"
        previousUrl={requestPageHref(filters, page - 1)}
        nextUrl={requestPageHref(filters, page + 1)}
      />
    </Page>
  );
}

function requestPageHref(filters: {status: string; search: string}, page: number) {
  const params = new URLSearchParams();
  if (filters.search) params.set('q', filters.search);
  if (filters.status) params.set('status', filters.status);
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return query ? `/app/requests?${query}` : '/app/requests';
}
