import {describe, expect, it} from 'vitest';
import {decodeOpaqueCursor, encodeOpaqueCursor} from '../../lib/shopify-signatures.server';
import {
  adminCursorMatches,
  adminReviewCursorPayload,
  adminReviewHref,
  applyAdminCursor,
  filterAndSortReviews,
  pageOfReviews,
  parseAdminReviewListQuery,
  readAdminReviewCursor,
  type AdminListReview,
} from './review-list';

const secret = 'admin-review-cursor-secret';

function reviews(count: number): AdminListReview[] {
  return Array.from({length: count}, (_item, index) => ({
    id: `r${String(index).padStart(4, '0')}`,
    rating: (index % 5) + 1,
    submittedAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
    status: index % 7 === 0 ? 'PENDING' : index % 11 === 0 ? 'REJECTED' : 'APPROVED',
    body: index % 4 === 0 ? 'Soft snow review' : 'Everyday ride',
    displayName: index % 3 === 0 ? 'Ankit' : 'Customer',
    productTitle: index % 2 === 0 ? 'Liquid Snowboard' : 'Powder Board',
  }));
}

function query(params: string) {
  return parseAdminReviewListQuery(new URLSearchParams(params));
}

describe('admin review pagination', () => {
  it('reads the first page at the default size of 20', () => {
    const page = pageOfReviews(reviews(126), query(''));
    expect(page.page).toBe(1);
    expect(page.pages).toBe(7);
    expect(page.total).toBe(126);
    expect(page.items).toHaveLength(20);
    expect(page.label).toBe('1–20 of 126 reviews');
    expect(page.items[0]?.id).toBe('r0125');
  });

  it('returns the next and previous pages without duplicates or gaps', () => {
    const source = reviews(126);
    const seen = new Set<string>();
    for (let pageNumber = 1; pageNumber <= 7; pageNumber += 1) {
      const page = pageOfReviews(source, query(`page=${pageNumber}`));
      expect(page.page).toBe(pageNumber);
      for (const review of page.items) {
        expect(seen.has(review.id)).toBe(false);
        seen.add(review.id);
      }
    }
    expect(seen.size).toBe(126);
    expect([...seen].sort()).toEqual(source.map((review) => review.id).sort());
    const second = pageOfReviews(source, query('page=2'));
    const first = pageOfReviews(source, query('page=1'));
    expect(second.items[0]?.id).not.toBe(first.items[0]?.id);
    const oldestOnFirst = first.items.at(-1)?.submittedAt ?? '';
    const newestOnSecond = second.items[0]?.submittedAt ?? '';
    expect(oldestOnFirst >= newestOnSecond).toBe(true);
  });

  it('handles an empty list and a result that fits on one page', () => {
    expect(pageOfReviews([], query('')).items).toEqual([]);
    expect(pageOfReviews([], query('')).label).toBe('');
    const exact = pageOfReviews(reviews(20), query(''));
    expect(exact.pages).toBe(1);
    expect(exact.items).toHaveLength(20);
    expect(pageOfReviews(reviews(20), query('page=2')).page).toBe(1);
  });

  it('keeps the highest-rating sort on later pages', () => {
    const source = reviews(45);
    const first = pageOfReviews(source, query('sort=highest&pageSize=10'));
    const second = pageOfReviews(source, query('sort=highest&pageSize=10&page=2'));
    expect(first.items.every((review, index, list) => index === 0 || list[index - 1].rating >= review.rating)).toBe(true);
    expect(Math.min(...first.items.map((review) => review.rating))).toBeGreaterThanOrEqual(Math.max(...second.items.map((review) => review.rating)));
    expect(adminReviewHref(query('sort=highest&rating=4&pageSize=10&page=2'), 3)).toBe('/app/reviews?rating=4&sort=highest&pageSize=10&page=3');
  });

  it('paginates a star filter and a search without mixing in other reviews', () => {
    const filtered = pageOfReviews(reviews(100), query('rating=4&pageSize=10&page=2'));
    expect(filtered.items.every((review) => review.rating === 4)).toBe(true);
    expect(filtered.page).toBe(2);
    expect(filtered.items).toHaveLength(10);
    const searched = pageOfReviews(reviews(40), query('q=soft%20snow&pageSize=10'));
    expect(searched.total).toBe(10);
    expect(searched.items.every((review) => review.body.toLowerCase().includes('soft snow'))).toBe(true);
  });

  it('returns to the first page when the filter query no longer includes a page', () => {
    const changed = query('sort=lowest&rating=4&pageSize=20');
    expect(changed.page).toBe(1);
    expect(changed.sort).toBe('lowest');
    expect(changed.rating).toBe(4);
    expect(filterAndSortReviews(reviews(12), changed).every((review) => review.rating === 4)).toBe(true);
  });

  it('rejects an invalid cursor and a cursor from another sort or filter', () => {
    const current = query('sort=highest&rating=4&page=2&pageSize=20');
    expect(readAdminReviewCursor('not-a-cursor')).toBeNull();
    expect(decodeOpaqueCursor('bad.cursor.value', secret)).toBeNull();
    expect(applyAdminCursor(current, null, true)).toEqual({query: {...current, page: 1}, rejected: true});

    const otherSort = readAdminReviewCursor(decodeOpaqueCursor(encodeOpaqueCursor(adminReviewCursorPayload({...current, sort: 'newest'}, 2), secret), secret) ?? '');
    expect(adminCursorMatches(otherSort!, current)).toBe(false);
    expect(applyAdminCursor(current, otherSort, true).rejected).toBe(true);

    const otherFilter = readAdminReviewCursor(decodeOpaqueCursor(encodeOpaqueCursor(adminReviewCursorPayload({...current, rating: 5}, 2), secret), secret) ?? '');
    expect(adminCursorMatches(otherFilter!, current)).toBe(false);

    const matching = readAdminReviewCursor(decodeOpaqueCursor(encodeOpaqueCursor(adminReviewCursorPayload(current, 2), secret), secret) ?? '');
    expect(applyAdminCursor(current, matching, true)).toEqual({query: current, rejected: false});
  });
});
