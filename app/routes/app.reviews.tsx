import {Form, useLoaderData, useNavigation} from 'react-router';
import {AdminListPagination} from '../components/admin-list-pagination';
import {AdminShell, Badge, EmbeddedFields, EmptyState, RatingStars, Skeleton, ToggleSwitch, statusTone} from '../components/admin/ui';
import {authenticate} from '../shopify.server';
import {config} from '../config.server';
import {db} from '../db.server';
import {decodeOpaqueCursor, encodeOpaqueCursor} from '../lib/shopify-signatures.server';
import {moderateReview} from '../modules/reviews/moderation.service.server';
import {pageCount} from '../modules/admin/page';
import {
  adminReviewCursorPayload,
  adminReviewHref,
  applyAdminCursor,
  parseAdminReviewListQuery,
  readAdminReviewCursor,
  reviewOrderBy,
} from '../modules/admin/review-list';

export async function loader({request}: {request: Request}) {
  const {session} = await authenticate.admin(request);
  const url = new URL(request.url);
  const parsed = parseAdminReviewListQuery(url.searchParams);
  const cursorValue = url.searchParams.get('cursor');
  const decoded = cursorValue ? decodeOpaqueCursor(cursorValue, config.SHOPIFY_API_SECRET) : null;
  const resolved = applyAdminCursor(parsed, decoded ? readAdminReviewCursor(decoded) : null, Boolean(cursorValue));
  const listQuery = resolved.query;
  const shop = await db.shop.findUnique({where: {shopDomain: session.shop}, select: {id: true}});
  const where = {
    shopId: shop?.id ?? '',
    deletedAt: null,
    ...(listQuery.status ? {status: listQuery.status} : {}),
    ...(listQuery.rating ? {rating: listQuery.rating} : {}),
    ...(listQuery.search ? {OR: [
      {body: {contains: listQuery.search, mode: 'insensitive' as const}},
      {displayName: {contains: listQuery.search, mode: 'insensitive' as const}},
      {title: {contains: listQuery.search, mode: 'insensitive' as const}},
      {product: {title: {contains: listQuery.search, mode: 'insensitive' as const}}},
    ]} : {}),
  };
  const total = shop ? await db.review.count({where}) : 0;
  const pages = pageCount(total, listQuery.pageSize);
  const page = Math.min(listQuery.page, pages);
  const reviews = shop && total > 0 ? await db.review.findMany({
    where,
    orderBy: reviewOrderBy(listQuery.sort),
    skip: (page - 1) * listQuery.pageSize,
    take: listQuery.pageSize,
    select: {
      id: true,
      rating: true,
      title: true,
      body: true,
      displayName: true,
      status: true,
      verifiedPurchase: true,
      submittedAt: true,
      product: {select: {title: true}},
    },
  }) : [];
  const query = {...listQuery, page};
  const cursorFor = (target: number) => encodeOpaqueCursor(adminReviewCursorPayload(query, target), config.SHOPIFY_API_SECRET);
  return {
    reviews: reviews.map((review) => ({...review, submittedAt: review.submittedAt.toISOString()})),
    filters: query,
    page,
    pages,
    total,
    cursorRejected: resolved.rejected,
    previousUrl: page > 1 ? adminReviewHref(query, page - 1, cursorFor(page - 1)) : null,
    nextUrl: page < pages ? adminReviewHref(query, page + 1, cursorFor(page + 1)) : null,
    firstUrl: adminReviewHref(query, 1, cursorFor(1)),
    lastUrl: adminReviewHref(query, pages, cursorFor(pages)),
  };
}

export async function action({request}: {request: Request}) {
  const {session} = await authenticate.admin(request);
  const shop = await db.shop.findUnique({where: {shopDomain: session.shop}, select: {id: true}});
  const form = await request.formData();
  const reviewId = String(form.get('reviewId') ?? '');
  const decision = form.get('decision');
  if (shop && reviewId && ['APPROVE', 'REJECT', 'HIDE', 'DELETE', 'FEATURE', 'VERIFY', 'UNVERIFY'].includes(String(decision))) {
    await moderateReview({
      shopId: shop.id,
      reviewId,
      action: decision as 'APPROVE' | 'REJECT' | 'HIDE' | 'DELETE' | 'FEATURE' | 'VERIFY' | 'UNVERIFY',
    });
  }
  return null;
}

export default function Reviews() {
  const {reviews, filters, page, pages, total, previousUrl, nextUrl, firstUrl, lastUrl, cursorRejected} = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const loading = navigation.state === 'loading';
  return (
    <AdminShell
      title="Reviews"
      subtitle="Review requests provide the customer-submitted reviews for this store."
    >
      {cursorRejected ? <p className="mb-3 text-sm text-[#8a6116]" role="status">That page link did not match these filters, so the first page is shown.</p> : null}
      <Form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        <EmbeddedFields />
        <label className="grid gap-1 text-xs font-semibold text-[#6d7175]">
          Search
          <input name="q" defaultValue={filters.search} placeholder="Reviews or products" className="min-h-10 rounded-lg border border-[#c9cccf] bg-white px-3 text-sm font-normal text-[#202223]" />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-[#6d7175]">
          Status
          <select name="status" defaultValue={filters.status} aria-label="Filter by status" className="min-h-10 rounded-lg border border-[#c9cccf] bg-white px-2 text-sm font-normal text-[#202223]">
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="HIDDEN">Hidden</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-[#6d7175]">
          Rating
          <select name="rating" defaultValue={filters.rating ? String(filters.rating) : ''} aria-label="Filter by rating" className="min-h-10 rounded-lg border border-[#c9cccf] bg-white px-2 text-sm font-normal text-[#202223]">
            <option value="">All ratings</option>
            {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} stars</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-[#6d7175]">
          Sort
          <select name="sort" defaultValue={filters.sort} aria-label="Sort reviews" className="min-h-10 rounded-lg border border-[#c9cccf] bg-white px-2 text-sm font-normal text-[#202223]">
            <option value="newest">Newest</option>
            <option value="highest">Highest</option>
            <option value="lowest">Lowest</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-[#6d7175]">
          Per page
          <select name="pageSize" defaultValue={String(filters.pageSize)} aria-label="Reviews per page" className="min-h-10 rounded-lg border border-[#c9cccf] bg-white px-2 text-sm font-normal text-[#202223]">
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
          </select>
        </label>
        <button type="submit" className="min-h-10 rounded-lg bg-[#008060] px-3 text-sm font-semibold text-white">Apply</button>
      </Form>
      {loading ? (
        <div className="grid gap-3" aria-busy="true" aria-label="Loading reviews">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-12" />
        </div>
      ) : reviews.length === 0 ? (
        <EmptyState title="No reviews yet">
          Customer reviews submitted through verified review-request links will appear here. Approve a review to show it on the storefront.
        </EmptyState>
      ) : (
        <div className="grid gap-3">
          {reviews.map((review) => (
            <article key={review.id} className="rounded-xl border border-[#e3e3e3] bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="text-base font-semibold">{review.product.title}</h2>
                <div className="flex flex-wrap gap-2">
                  {review.verifiedPurchase ? <Badge tone="success">Verified</Badge> : null}
                  <Badge tone={statusTone(review.status)}>{review.status}</Badge>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <RatingStars rating={review.rating} label={`${review.rating} out of 5 stars`} />
                <time className="text-xs text-[#6d7175]" dateTime={review.submittedAt}>{new Date(review.submittedAt).toLocaleString()}</time>
              </div>
              <p className="mt-2 text-sm font-semibold">{review.displayName || 'Customer'}</p>
              {review.title ? <p className="text-sm font-semibold">{review.title}</p> : null}
              <p className="mt-1 text-sm">{review.body}</p>
              <Form method="post" className="mt-3">
                <input type="hidden" name="reviewId" value={review.id} />
                <input type="hidden" name="decision" value={review.verifiedPurchase ? 'UNVERIFY' : 'VERIFY'} />
                <ToggleSwitch
                  label={`Verified buyer for ${review.displayName || 'this review'}`}
                  checked={review.verifiedPurchase}
                  onChange={(_checked, event) => event.currentTarget.form?.requestSubmit()}
                />
              </Form>
              {review.status === 'PENDING' ? (
                <Form method="post" className="mt-3 flex flex-wrap gap-2">
                  <input type="hidden" name="reviewId" value={review.id} />
                  <button type="submit" name="decision" value="APPROVE" className="min-h-10 rounded-lg bg-[#008060] px-3 text-sm font-semibold text-white">Approve</button>
                  <button type="submit" name="decision" value="REJECT" className="min-h-10 rounded-lg border border-[#d72c0d] bg-white px-3 text-sm font-semibold text-[#d72c0d]">Disapprove</button>
                </Form>
              ) : null}
              {review.status !== 'DELETED' ? (
                <Form method="post" className="mt-3 flex flex-wrap gap-2">
                  <input type="hidden" name="reviewId" value={review.id} />
                  <button type="submit" name="decision" value="FEATURE" className="min-h-10 rounded-lg border border-[#c9cccf] bg-white px-3 text-sm font-semibold">Feature</button>
                  <button type="submit" name="decision" value="HIDE" className="min-h-10 rounded-lg border border-[#c9cccf] bg-white px-3 text-sm font-semibold">Hide</button>
                  <button type="submit" name="decision" value="DELETE" className="min-h-10 rounded-lg border border-[#d72c0d] bg-white px-3 text-sm font-semibold text-[#d72c0d]" onClick={(event) => {
                    if (!window.confirm('Delete this review?')) event.preventDefault();
                  }}>Delete</button>
                </Form>
              ) : null}
            </article>
          ))}
        </div>
      )}
      {total > 0 ? (
        <AdminListPagination
          page={page}
          pages={pages}
          total={total}
          noun="review"
          pageSize={filters.pageSize}
          previousUrl={previousUrl}
          nextUrl={nextUrl}
          firstUrl={firstUrl}
          lastUrl={lastUrl}
        />
      ) : null}
    </AdminShell>
  );
}
