import {Form, useActionData, useLoaderData, useNavigation} from 'react-router';
import {AdminListPagination} from '../components/admin-list-pagination';
import {AdminShell, Badge, EmbeddedFields, EmptyState, Skeleton, statusTone} from '../components/admin/ui';
import {authenticate} from '../shopify.server';
import {db} from '../db.server';
import {isSameOrigin} from '../lib/csrf.server';
import {decryptData} from '../lib/encrypted-data.server';
import {maskEmail} from '../modules/email/delivery.server';
import {deliveryLabel} from '../modules/email/delivery-state';
import {adminPage, adminPageSize, pageCount} from '../modules/admin/page';
import {reviewEmailTrigger} from '../modules/commerce/fulfillment-lines';
import {createTestReviewRequest, queueReviewRequest} from '../modules/reviews/request-test.server';

export async function loader({request}: {request: Request}) {
  const {session} = await authenticate.admin(request);
  const url = new URL(request.url);
  const allowedStatuses = ['PENDING', 'SCHEDULED', 'SENT', 'OPENED', 'FAILED', 'BLOCKED', 'EXPIRED', 'SUBMITTED', 'CANCELLED'] as const;
  const requestedStatus = url.searchParams.get('status');
  const status = allowedStatuses.find((value) => value === requestedStatus);
  const search = url.searchParams.get('q')?.trim();
  const pageSize = adminPageSize(url.searchParams.get('pageSize'));
  const page = adminPage(url.searchParams.get('page'));
  const shop = await db.shop.findUnique({where: {shopDomain: session.shop}, select: {id: true, settings: {select: {reviewRequestTrigger: true}}}});
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
        isTest: true,
        testRecipientEncrypted: true,
        customer: {select: {displayName: true, emailEncrypted: true, consents: {where: {purpose: 'review_request', granted: false}, select: {id: true}, take: 1}}},
        product: {select: {title: true}},
        order: {select: {orderNumber: true, items: {select: {variantTitle: true, product: {select: {title: true}}}}}},
      },
    }) : [];
  const grouped = shop ? await db.reviewRequest.groupBy({by: ['status'], where: {shopId: shop.id}, _count: {_all: true}}) : [];
  const count = (value: string) => grouped.find((row) => row.status === value)?._count._all ?? 0;
  return {
    trigger: reviewEmailTrigger(shop?.settings?.reviewRequestTrigger),
    counts: {
      pending: count('PENDING'),
      queued: count('SCHEDULED') + count('SENDING'),
      sent: count('SENT') + count('OPENED') + count('CLICKED'),
      failed: count('FAILED'),
      blocked: count('BLOCKED'),
      reviewed: count('SUBMITTED'),
    },
    filters: {status: status ?? '', search: search ?? '', pageSize},
    page: safePage,
    pages,
    total,
    requests: requests.map((reviewRequest) => ({
      id: reviewRequest.id,
      status: reviewRequest.status,
      isTest: reviewRequest.isTest,
      scheduledAt: reviewRequest.scheduledAt,
      sentAt: reviewRequest.sentAt,
      lastError: reviewRequest.lastError,
      productTitle: reviewRequest.product?.title ?? 'Product',
      orderNumber: reviewRequest.order?.orderNumber ?? '',
      customerName: reviewRequest.isTest ? 'Test recipient' : (reviewRequest.customer?.displayName ?? 'Customer'),
      delivery: deliveryLabel(reviewRequest.status, reviewRequest.reminderCount),
      label: requestStatusLabel(reviewRequest.status),
      email: reviewRequest.isTest ? testRecipientLabel(reviewRequest.testRecipientEncrypted) : maskedRecipient(reviewRequest.customer?.emailEncrypted),
      productCount: reviewRequest.order?.items.length ?? (reviewRequest.product ? 1 : 0),
      products: reviewRequest.order?.items.map((item) => item.variantTitle && item.variantTitle !== 'Default Title' ? `${item.product.title} (${item.variantTitle})` : item.product.title) ?? [],
      unsubscribed: Boolean(reviewRequest.customer?.consents.length),
    })),
  };
}

export async function action({request}: {request: Request}) {
  const {admin, session} = await authenticate.admin(request);
  if (!isSameOrigin(request)) return {error: 'Request could not be verified.'};
  const shop = await db.shop.findUnique({where: {shopDomain: session.shop}, select: {id: true}});
  if (!shop) return {error: 'Shop is not initialized.'};
  const form = await request.formData();
  const intent = String(form.get('intent') ?? '');
  if (intent === 'test') {
    const result = await createTestReviewRequest({
      admin,
      shopId: shop.id,
      orderNumber: String(form.get('orderNumber') ?? ''),
      testRecipient: String(form.get('testRecipient') ?? ''),
    });
    if (!result.ok) return {error: result.error};
    return {queued: true, orderNumber: result.orderNumber, productCount: result.productCount};
  }
  if (intent === 'send' || intent === 'retry') {
    const result = await queueReviewRequest({shopId: shop.id, requestId: String(form.get('requestId') ?? ''), intent});
    return result.ok ? {queued: true} : {error: result.error};
  }
  return {error: 'Unknown action.'};
}

function testRecipientLabel(emailEncrypted: string | null | undefined) {
  if (!emailEncrypted) return 'unavailable';
  try {
    return decryptData(emailEncrypted);
  } catch {
    return 'unavailable';
  }
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
  if (status === 'BLOCKED') return 'Blocked';
  if (status === 'SCHEDULED' || status === 'SENDING') return 'Queued';
  if (status === 'EXPIRED') return 'Expired';
  if (status === 'CANCELLED') return 'Cancelled';
  return 'Pending';
}

export default function ReviewRequests() {
  const {requests, filters, page, pages, total, counts, trigger} = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const navigation = useNavigation();
  const sentStatuses = new Set(['SENT', 'OPENED', 'CLICKED', 'SUBMITTED']);
  return (
    <AdminShell title="Review requests" subtitle="One review email per order. Test emails go only to the address you enter.">
      {result?.error ? <p className="mb-4 rounded-lg bg-[#fee9e8] px-3 py-2 text-sm text-[#8e1f0b]" role="alert">{result.error}</p> : null}
      {result && 'queued' in result && result.queued ? <p className="mb-4 rounded-lg bg-[#e3f1df] px-3 py-2 text-sm text-[#0c5132]" role="status">{'orderNumber' in result ? `TEST request queued for order #${result.orderNumber} (${result.productCount} products).` : 'Request queued.'}</p> : null}
      <Form method="post" className="mb-4 grid gap-3 rounded-xl border border-[#e3e3e3] bg-white p-4">
        <h2 className="text-base font-semibold">Send test review request</h2>
        <p className="rounded-lg bg-[#fff5ea] px-3 py-2 text-sm text-[#8a6116]" role="note">TEST MODE — this email will be sent to the test address and will not use the customer&apos;s email.</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-xs font-semibold text-[#6d7175]">
            Order number
            <input name="orderNumber" placeholder="1003" className="min-h-10 rounded-lg border border-[#c9cccf] px-3 text-sm font-normal text-[#202223]" autoComplete="off" />
          </label>
          <label className="grid min-w-64 gap-1 text-xs font-semibold text-[#6d7175]">
            TEST recipient
            <input name="testRecipient" type="email" required placeholder="Enter an email address" className="min-h-10 rounded-lg border border-[#c9cccf] px-3 text-sm font-normal text-[#202223]" autoComplete="off" />
          </label>
          <input type="hidden" name="intent" value="test" />
          <button type="submit" className="min-h-10 rounded-lg bg-[#008060] px-3 text-sm font-semibold text-white" disabled={navigation.state === 'submitting'}>Send test review request</button>
        </div>
      </Form>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {([
          ['Pending', counts.pending],
          ['Queued', counts.queued],
          ['Sent', counts.sent],
          ['Failed', counts.failed],
          ['Blocked', counts.blocked],
          ['Reviewed', counts.reviewed],
        ] as const).map(([label, value]) => (
          <div key={label} className="rounded-xl border border-[#e3e3e3] bg-white p-3">
            <p className="text-xs font-semibold text-[#6d7175]">{label}</p>
            <p className="text-xl font-semibold">{value}</p>
          </div>
        ))}
      </div>
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
            {['PENDING', 'SCHEDULED', 'SENT', 'OPENED', 'FAILED', 'BLOCKED', 'EXPIRED', 'SUBMITTED', 'CANCELLED'].map((value) => <option key={value} value={value}>{requestStatusLabel(value)}</option>)}
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
        <div className="overflow-x-auto rounded-xl border border-[#e3e3e3] bg-white">
          <table className="min-w-[760px] w-full text-left text-sm">
            <thead className="border-b border-[#e3e3e3] text-xs uppercase text-[#6d7175]">
              <tr>
                <th className="px-3 py-2 font-semibold">Order</th>
                <th className="px-3 py-2 font-semibold">Recipient</th>
                <th className="px-3 py-2 font-semibold">Products</th>
                <th className="px-3 py-2 font-semibold">Trigger</th>
                <th className="px-3 py-2 font-semibold">Scheduled</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id} className="border-b border-[#f1f2f3] align-top">
                  <td className="px-3 py-3 font-semibold">{request.orderNumber ? `#${request.orderNumber.replace(/^#/, '')}` : 'unavailable'}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap items-center gap-1">
                      {request.isTest ? <Badge tone="warning">TEST</Badge> : null}
                      <span>{request.email}</span>
                    </div>
                    {request.isTest ? <p className="text-xs text-[#6d7175]">Test recipient</p> : <p className="text-xs text-[#6d7175]">{request.customerName}</p>}
                  </td>
                  <td className="px-3 py-3">{request.productCount}</td>
                  <td className="px-3 py-3">{trigger === 'PAID' ? 'Paid' : 'Fulfilled'}</td>
                  <td className="px-3 py-3">{request.scheduledAt ? new Date(request.scheduledAt).toLocaleString() : 'not scheduled'}</td>
                  <td className="px-3 py-3"><Badge tone={statusTone(request.status)}>{request.label}</Badge></td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      {request.isTest && !sentStatuses.has(request.status) ? (
                        <Form method="post"><input type="hidden" name="intent" value="send" /><input type="hidden" name="requestId" value={request.id} /><button className="font-semibold text-[#008060]" type="submit">Send</button></Form>
                      ) : null}
                      {(request.status === 'FAILED' || request.status === 'BLOCKED') ? (
                        <Form method="post"><input type="hidden" name="intent" value="retry" /><input type="hidden" name="requestId" value={request.id} /><button className="font-semibold text-[#008060]" type="submit">Retry</button></Form>
                      ) : null}
                      <details>
                        <summary className="cursor-pointer font-semibold text-[#008060]">View details</summary>
                        <div className="mt-2 grid gap-1 text-xs text-[#6d7175]">
                          <p>Delivery: {request.delivery}</p>
                          <p>Products: {request.products.join(', ') || request.productTitle}</p>
                          {request.lastError ? <p className="text-[#8e1f0b]">{request.lastError}</p> : null}
                        </div>
                      </details>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
