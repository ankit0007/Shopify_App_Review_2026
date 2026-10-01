import {useState} from 'react';
import {data, Form, useLoaderData} from 'react-router';
import {BlockStack, Card, EmptyState, InlineStack, Page, Text} from '@shopify/polaris';
import {AdminListPagination} from '../components/admin-list-pagination';
import {AddReviewDialog} from '../components/add-review-dialog';
import {authenticate} from '../shopify.server';
import {db} from '../db.server';
import {adminReviewRequestAllowed, canonicalProductId} from '../modules/reviews/admin-review';
import {createAdminReview, readAdminReviewForm, verifyShopProduct} from '../modules/reviews/admin-review.server';
import {moderateReview} from '../modules/reviews/moderation.service.server';
import {formatAverage} from '../modules/reviews/rating';
import {ADMIN_PAGE_SIZE, adminPage, pageCount} from '../modules/admin/page';

export async function loader({request}: {request: Request}) {
  const {session} = await authenticate.admin(request);
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const rating = Number(url.searchParams.get('rating') ?? 0);
  const search = url.searchParams.get('q')?.trim();
  const page = adminPage(url.searchParams.get('page'));
  const shop = await db.shop.findUnique({where: {shopDomain: session.shop}, select: {id: true}});
  const where = {
    shopId: shop?.id ?? '',
    deletedAt: null,
    ...(status && ['PENDING', 'APPROVED', 'REJECTED', 'HIDDEN'].includes(status) ? {status: status as 'PENDING' | 'APPROVED' | 'REJECTED' | 'HIDDEN'} : {}),
    ...(rating >= 1 && rating <= 5 ? {rating} : {}),
    ...(search ? {OR: [{body: {contains: search, mode: 'insensitive' as const}}, {displayName: {contains: search, mode: 'insensitive' as const}}, {product: {title: {contains: search, mode: 'insensitive' as const}}}]} : {}),
  };
  const [total, reviews] = shop
    ? await Promise.all([
      db.review.count({where}),
      db.review.findMany({
        where,
        orderBy: {submittedAt: 'desc'},
        skip: (page - 1) * ADMIN_PAGE_SIZE,
        take: ADMIN_PAGE_SIZE,
        select: {
          id: true,
          rating: true,
          body: true,
          displayName: true,
          status: true,
          product: {select: {title: true}},
          events: {where: {action: 'ADMIN_CREATED'}, select: {id: true}, take: 1},
        },
      }),
    ])
    : [0, []];
  return {
    reviews: reviews.map(({events, ...review}) => ({...review, adminAdded: events.length > 0})),
    filters: {status: status ?? '', rating: rating ? String(rating) : '', search: search ?? ''},
    page,
    pages: pageCount(total),
    total,
  };
}

export async function action({request}: {request: Request}) {
  const {session, admin} = await authenticate.admin(request);
  const shop = await db.shop.findUnique({where: {shopDomain: session.shop}, select: {id: true}});
  const form = await request.formData();
  if (form.get('intent') === 'create') {
    if (!adminReviewRequestAllowed(request)) {
      return data({ok: false, message: 'Request could not be verified.', fieldErrors: {}}, {status: 403});
    }
    if (!shop) return data({ok: false, message: 'Shop is not available.', fieldErrors: {}}, {status: 400});
    const productId = canonicalProductId(form.get('productId'));
    const parsed = readAdminReviewForm(form);
    const fieldErrors = parsed.ok ? {} : parsed.fieldErrors;
    if (!productId) fieldErrors.productId = 'Select a product from this store.';
    if (!parsed.ok || !productId) {
      return data({ok: false, message: 'Check the highlighted fields.', fieldErrors}, {status: 400});
    }
    try {
      const product = await verifyShopProduct(admin, productId);
      if (!product) {
        return data({ok: false, message: 'That product is not available in this store.', fieldErrors: {productId: 'That product is not available in this store.'}}, {status: 400});
      }
      const result = await createAdminReview({shopId: shop.id, shopDomain: session.shop, product, data: parsed.data});
      return data(result, {status: result.ok ? 200 : 400});
    } catch {
      return data({ok: false, message: 'The review could not be added. Please try again.', fieldErrors: {}}, {status: 500});
    }
  }
  const reviewId = String(form.get('reviewId') ?? '');
  const decision = form.get('decision');
  if (shop && reviewId && ['APPROVE', 'REJECT', 'HIDE', 'DELETE', 'FEATURE'].includes(String(decision))) {
    await moderateReview({
      shopId: shop.id,
      reviewId,
      action: decision as 'APPROVE' | 'REJECT' | 'HIDE' | 'DELETE' | 'FEATURE',
    });
  }
  return null;
}

const STAR_PATH = 'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z';

function Stars({rating}: {rating: number}) {
  return (
    <span aria-label={`${rating} out of 5 stars`} style={{display: 'inline-flex', gap: 2}}>
      {[1, 2, 3, 4, 5].map((value) => (
        <svg key={value} viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d={STAR_PATH} fill={value <= rating ? '#F5B301' : '#D9DDE3'} />
        </svg>
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
  const {reviews, filters, page, pages, total} = useLoaderData<typeof loader>();
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<null | {
    productTitle: string;
    rating: number;
    displayName: string;
    status: 'APPROVED' | 'PENDING';
    averageRating: number | null;
    reviewCount: number;
  }>(null);
  return (
    <Page title="Reviews" primaryAction={{content: 'Add Review', onAction: () => setAdding(true)}}>
      <AddReviewDialog open={adding} onClose={(review) => {
        setAdding(false);
        if (review) setNotice(review);
      }} />
      {notice ? (
        <div role="status" style={successNotice}>
          <strong>Review added successfully.</strong>
          <p>{notice.productTitle} · {notice.rating} out of 5 stars · {notice.displayName} · {notice.status === 'APPROVED' ? 'Approved' : 'Pending'}</p>
          <p>{notice.status === 'APPROVED'
            ? `Public rating is now ${formatAverage(notice.averageRating) ?? '0.0'} from ${notice.reviewCount} ${notice.reviewCount === 1 ? 'review' : 'reviews'}.`
            : 'This review is pending and is not included in the public rating.'}</p>
        </div>
      ) : null}
      <Form method="get">
        <InlineStack gap="200" wrap>
          <input name="q" defaultValue={filters.search} placeholder="Search reviews or products" />
          <select name="status" defaultValue={filters.status} aria-label="Filter by status">
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="HIDDEN">Hidden</option>
          </select>
          <select name="rating" defaultValue={filters.rating} aria-label="Filter by rating">
            <option value="">All ratings</option>
            {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} stars</option>)}
          </select>
          <button type="submit" style={filterButton}>Filter</button>
        </InlineStack>
      </Form>
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
                    <InlineStack gap="200">
                      {review.adminAdded ? <span style={adminBadge}>Admin added</span> : null}
                      <span style={{padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, color: tone.color, background: tone.background}}>
                        {review.status}
                      </span>
                    </InlineStack>
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
                  {review.status !== 'DELETED' ? (
                    <Form method="post">
                      <input type="hidden" name="reviewId" value={review.id} />
                      <InlineStack gap="200">
                        <button type="submit" name="decision" value="FEATURE" style={secondaryButton}>Feature</button>
                        <button type="submit" name="decision" value="HIDE" style={secondaryButton}>Hide</button>
                        <button type="submit" name="decision" value="DELETE" style={deleteButton} onClick={(event) => {
                          if (!window.confirm('Delete this review?')) event.preventDefault();
                        }}>Delete</button>
                      </InlineStack>
                    </Form>
                  ) : null}
                </BlockStack>
              </Card>
            );
          })}
        </BlockStack>
      )}
      <AdminListPagination
        page={page}
        pages={pages}
        total={total}
        noun="review"
        previousUrl={reviewPageHref(filters, page - 1)}
        nextUrl={reviewPageHref(filters, page + 1)}
      />
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

const secondaryButton = {
  padding: '7px 12px',
  border: '1px solid #9ca3af',
  borderRadius: 8,
  background: '#fff',
  color: '#374151',
  fontWeight: 600,
  cursor: 'pointer',
};

const deleteButton = {...secondaryButton, borderColor: '#991b1b', color: '#991b1b'};
const filterButton = {...approveButton, background: '#1d4ed8'};
const adminBadge = {padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, color: '#1e3a8a', background: '#dbeafe'};
const successNotice = {padding: 16, borderRadius: 12, background: '#dcfce7', color: '#166534', display: 'grid', gap: 4};

function reviewPageHref(filters: {status: string; rating: string; search: string}, page: number) {
  const params = new URLSearchParams();
  if (filters.search) params.set('q', filters.search);
  if (filters.status) params.set('status', filters.status);
  if (filters.rating) params.set('rating', filters.rating);
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return query ? `/app/reviews?${query}` : '/app/reviews';
}
