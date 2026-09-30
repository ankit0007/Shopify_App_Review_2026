export type ReviewSort = 'newest' | 'highest' | 'lowest';

export function parseListQuery(sort: string | null, rating: string | null) {
  if (sort && sort !== 'newest' && sort !== 'highest' && sort !== 'lowest') {
    return {ok: false as const, code: 'INVALID_SORT'};
  }
  if (rating && !/^[1-5]$/.test(rating)) return {ok: false as const, code: 'INVALID_RATING'};
  return {
    ok: true as const,
    sort: (sort ?? 'newest') as ReviewSort,
    rating: rating ? Number(rating) : null,
  };
}

export function cursorPayload(sort: ReviewSort, rating: number | null, id: string) {
  const code = sort === 'highest' ? 'h' : sort === 'lowest' ? 'l' : 'n';
  return `${code}.${rating ?? 0}.${id}`;
}

export function readCursorPayload(value: string) {
  const match = /^(n|h|l)\.([0-5])\.([a-z0-9]{8,32})$/i.exec(value);
  if (!match?.[1] || !match[2] || !match[3]) return null;
  const sort: ReviewSort = match[1] === 'h' ? 'highest' : match[1] === 'l' ? 'lowest' : 'newest';
  const rating = Number(match[2]);
  return {sort, rating: rating === 0 ? null : rating, id: match[3]};
}

export function cursorMatchesQuery(payload: {sort: ReviewSort; rating: number | null}, query: {sort: ReviewSort; rating: number | null}) {
  return payload.sort === query.sort && payload.rating === query.rating;
}

export function emptyDistribution() {
  return {'1': 0, '2': 0, '3': 0, '4': 0, '5': 0};
}
