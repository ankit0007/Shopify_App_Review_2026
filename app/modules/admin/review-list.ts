import {adminPage, adminPageSize, adminRangeLabel, pageCount, type AdminPageSize} from './page';

export const ADMIN_REVIEW_SORTS = ['newest', 'highest', 'lowest'] as const;
export const ADMIN_REVIEW_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'HIDDEN'] as const;

export type AdminReviewSort = (typeof ADMIN_REVIEW_SORTS)[number];
export type AdminReviewStatus = (typeof ADMIN_REVIEW_STATUSES)[number];

export type AdminReviewQuery = {
  sort: AdminReviewSort;
  status: AdminReviewStatus | '';
  rating: number | null;
  search: string;
  page: number;
  pageSize: AdminPageSize;
};

export type AdminReviewCursor = {
  sort: AdminReviewSort;
  status: AdminReviewStatus | '';
  rating: number | null;
  search: string;
  pageSize: AdminPageSize;
  page: number;
};

export type AdminListReview = {
  id: string;
  rating: number;
  submittedAt: string;
  status: string;
  body: string;
  displayName: string;
  productTitle: string;
};

export function parseAdminReviewListQuery(params: URLSearchParams): AdminReviewQuery {
  const sortValue = params.get('sort');
  const statusValue = params.get('status');
  const ratingValue = Number(params.get('rating'));
  return {
    sort: ADMIN_REVIEW_SORTS.includes(sortValue as AdminReviewSort) ? sortValue as AdminReviewSort : 'newest',
    status: ADMIN_REVIEW_STATUSES.includes(statusValue as AdminReviewStatus) ? statusValue as AdminReviewStatus : '',
    rating: Number.isInteger(ratingValue) && ratingValue >= 1 && ratingValue <= 5 ? ratingValue : null,
    search: (params.get('q') ?? '').trim().slice(0, 120),
    page: adminPage(params.get('page')),
    pageSize: adminPageSize(params.get('pageSize')),
  };
}

export function adminReviewCursorPayload(query: AdminReviewQuery, page: number) {
  return JSON.stringify({
    v: 1,
    sort: query.sort,
    status: query.status,
    rating: query.rating,
    search: query.search,
    pageSize: query.pageSize,
    page,
  });
}

export function readAdminReviewCursor(value: string): AdminReviewCursor | null {
  try {
    const parsed = JSON.parse(value) as Partial<AdminReviewCursor> & {v?: number};
    if (parsed.v !== 1) return null;
    if (!ADMIN_REVIEW_SORTS.includes(parsed.sort as AdminReviewSort)) return null;
    if (parsed.status !== '' && !ADMIN_REVIEW_STATUSES.includes(parsed.status as AdminReviewStatus)) return null;
    if (parsed.rating != null && (!Number.isInteger(parsed.rating) || parsed.rating < 1 || parsed.rating > 5)) return null;
    if (typeof parsed.search !== 'string' || parsed.search.length > 120) return null;
    if (!( [10, 20, 50] as number[]).includes(Number(parsed.pageSize))) return null;
    if (!Number.isInteger(parsed.page) || (parsed.page ?? 0) < 1) return null;
    return {
      sort: parsed.sort as AdminReviewSort,
      status: (parsed.status ?? '') as AdminReviewStatus | '',
      rating: parsed.rating ?? null,
      search: parsed.search,
      pageSize: parsed.pageSize as AdminPageSize,
      page: parsed.page as number,
    };
  } catch {
    return null;
  }
}

export function adminCursorMatches(cursor: AdminReviewCursor, query: AdminReviewQuery) {
  return cursor.sort === query.sort &&
    cursor.status === query.status &&
    cursor.rating === query.rating &&
    cursor.search === query.search &&
    cursor.pageSize === query.pageSize &&
    cursor.page === query.page;
}

export function applyAdminCursor(query: AdminReviewQuery, cursor: AdminReviewCursor | null, hadCursor: boolean) {
  if (!hadCursor) return {query, rejected: false};
  if (!cursor || !adminCursorMatches(cursor, query)) return {query: {...query, page: 1}, rejected: true};
  return {query, rejected: false};
}

export function adminReviewHref(query: AdminReviewQuery, page: number, cursor?: string | null) {
  const params = new URLSearchParams();
  if (query.search) params.set('q', query.search);
  if (query.status) params.set('status', query.status);
  if (query.rating) params.set('rating', String(query.rating));
  if (query.sort !== 'newest') params.set('sort', query.sort);
  if (query.pageSize !== 20) params.set('pageSize', String(query.pageSize));
  if (page > 1) params.set('page', String(page));
  if (cursor) params.set('cursor', cursor);
  const text = params.toString();
  return text ? `/app/reviews?${text}` : '/app/reviews';
}

export function reviewOrderBy(sort: AdminReviewSort) {
  if (sort === 'highest') return [{rating: 'desc' as const}, {submittedAt: 'desc' as const}, {id: 'desc' as const}];
  if (sort === 'lowest') return [{rating: 'asc' as const}, {submittedAt: 'desc' as const}, {id: 'desc' as const}];
  return [{submittedAt: 'desc' as const}, {id: 'desc' as const}];
}

function compareReviews(sort: AdminReviewSort, left: AdminListReview, right: AdminListReview) {
  if (sort === 'highest' && left.rating !== right.rating) return right.rating - left.rating;
  if (sort === 'lowest' && left.rating !== right.rating) return left.rating - right.rating;
  const time = right.submittedAt.localeCompare(left.submittedAt);
  if (time !== 0) return time;
  return right.id.localeCompare(left.id);
}

export function filterAndSortReviews(reviews: AdminListReview[], query: Pick<AdminReviewQuery, 'sort' | 'status' | 'rating' | 'search'>) {
  const search = query.search.toLowerCase();
  return reviews
    .filter((review) => {
      if (query.status && review.status !== query.status) return false;
      if (query.rating && review.rating !== query.rating) return false;
      if (!search) return true;
      return review.body.toLowerCase().includes(search) ||
        review.displayName.toLowerCase().includes(search) ||
        review.productTitle.toLowerCase().includes(search);
    })
    .sort((left, right) => compareReviews(query.sort, left, right));
}

export function pageOfReviews(reviews: AdminListReview[], query: AdminReviewQuery) {
  const sorted = filterAndSortReviews(reviews, query);
  const pages = pageCount(sorted.length, query.pageSize);
  const page = Math.min(query.page, pages);
  const startIndex = (page - 1) * query.pageSize;
  return {
    items: sorted.slice(startIndex, startIndex + query.pageSize),
    total: sorted.length,
    page,
    pages,
    label: adminRangeLabel(page, sorted.length, 'review', query.pageSize),
  };
}
