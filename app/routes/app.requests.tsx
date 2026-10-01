import {Form, useLoaderData, useNavigation} from 'react-router';
import {AdminListPagination} from '../components/admin-list-pagination';
import {AdminShell, Badge, EmbeddedFields, EmptyState, Skeleton, statusTone} from '../components/admin/ui';
import {authenticate} from '../shopify.server';
import {db} from '../db.server';
import {decryptData} from '../lib/encrypted-data.server';
import {maskEmail} from '../modules/email/delivery.server';
import {deliveryLabel} from '../modules/email/delivery-state';
import {adminPage, adminPageSize, pageCount} from '../modules/admin/page';

export async function loader({request}: {request: Request}) {
  const {session} = await authenticate.admin(request);
  const url = new URL(request.url);
  const allowedStatuses = ['PENDING', 'SCHEDULED', 'SENT', 'OPENED', 'FAILED', 'EXPIRED', 'SUBMITTED', 'CANCELLED'] as const;
  const requestedStatus = url.searchParams.get('status');
  const status = allowedStatuses.find((value) => value === requestedStatus);
  const search = url.searchParams.get('q')?.trim();
  const pageSize = adminPageSize(url.searchParams.get('pageSize'));
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
  const total = shop ? await db.reviewRequest.count({where}) : 0;
  const pages = pageCount(total, pageSize);
  const safePage = Math.min(page, pages);
  const requests = shop ? await db.reviewRequest.findMany({
      where,
      orderBy: {createdAt: 'desc'},
      skip: (safePage - 1) * pageSize,
      take: pageSize,
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
    }) : [];
  return {
    filters: {status: status ?? '', search: search ?? '', pageSize},
    page: safePage,
    pages,
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
  const navigation = useNavigation();
  return (
    <AdminShell title="Review requests" subtitle="Automatic requests created after fulfilled orders.">
      <Form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        <EmbeddedFields />
        <label className="grid gap-1 text-xs font-semibold text-[#6d7175]">
          Search
          <input name="q" defaultValue={filters.search} placeholder="Product, customer, or order" className="min-h-10 rounded-lg border border-[#c9cccf] bg-white px-3 text-sm font-normal text-[#202223]" />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-[#6d7175]">
          Status
          <select name="status" defaultValue={filters.status} aria-label="Filter by status" className="min-h-10 rounded-lg border border-[#c9cccf] bg-white px-2 text-sm font-normal text-[#202223]">
            <option value="">All statuses</option>
            {['PENDING', 'SCHEDULED', 'SENT', 'OPENED', 'FAILED', 'EXPIRED', 'SUBMITTED', 'CANCELLED'].map((value) => <option key={value} value={value}>{requestStatusLabel(value)}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-[#6d7175]">
          Per page
          <select name="pageSize" defaultValue={String(filters.pageSize)} aria-label="Requests per page" className="min-h-10 rounded-lg border border-[#c9cccf] bg-white px-2 text-sm font-normal text-[#202223]">
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
          </select>
        </label>
        <button type="submit" className="min-h-10 rounded-lg bg-[#008060] px-3 text-sm font-semibold text-white">Apply</button>
      </Form>
      {navigation.state === 'loading' ? (
        <div className="grid gap-3" aria-busy="true"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
      ) : requests.length === 0 ? (
        <EmptyState title="No review requests yet">
          Automatic review-request activity will appear here after fulfilled orders are processed.
        </EmptyState>
      ) : (
        <div className="grid gap-3">
          {requests.map((request) => (
            <article key={request.id} className="rounded-xl border border-[#e3e3e3] bg-white p-4 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="text-base font-semibold">{request.product?.title ?? 'Product'}</h2>
                <Badge tone={statusTone(request.status)}>{request.label}</Badge>
              </div>
              <dl className="mt-3 grid gap-1 sm:grid-cols-2">
                <div>Customer <span className="font-semibold">{request.customer?.displayName ?? 'Customer'}</span></div>
                <div>Order <span className="font-semibold">{request.order?.orderNumber ?? 'unavailable'}</span></div>
                <div>Email <span className="font-semibold">{request.email}</span></div>
                <div>Products <span className="font-semibold">{request.productCount}</span></div>
                <div>Scheduled <span className="font-semibold">{request.scheduledAt ? new Date(request.scheduledAt).toLocaleString() : 'not scheduled'}</span></div>
                <div>Sent <span className="font-semibold">{request.sentAt ? new Date(request.sentAt).toLocaleString() : 'not sent'}</span></div>
                <div>Unsubscribed <span className="font-semibold">{request.unsubscribed ? 'yes' : 'no'}</span></div>
                <div>Opened <span className="font-semibold">{request.status === 'OPENED' || request.status === 'CLICKED' || request.status === 'SUBMITTED' ? 'yes' : 'no'}</span></div>
                <div>Reviewed <span className="font-semibold">{request.status === 'SUBMITTED' ? 'yes' : 'no'}</span></div>
                <div>Delivery <span className="font-semibold">{request.delivery}</span></div>
              </dl>
              {request.lastError ? <p className="mt-2 text-[#8e1f0b]">Failure: {request.lastError}</p> : null}
            </article>
          ))}
        </div>
      )}
      <AdminListPagination
        page={page}
        pages={pages}
        total={total}
        noun="request"
        pageSize={filters.pageSize}
        previousUrl={page > 1 ? requestPageHref(filters, page - 1) : null}
        nextUrl={page < pages ? requestPageHref(filters, page + 1) : null}
        firstUrl={requestPageHref(filters, 1)}
        lastUrl={requestPageHref(filters, pages)}
      />
    </AdminShell>
  );
}

function requestPageHref(filters: {status: string; search: string; pageSize: number}, page: number) {
  const params = new URLSearchParams();
  if (filters.search) params.set('q', filters.search);
  if (filters.status) params.set('status', filters.status);
  if (filters.pageSize !== 20) params.set('pageSize', String(filters.pageSize));
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return query ? `/app/requests?${query}` : '/app/requests';
}
