export const ADMIN_PAGE_SIZE = 5;

export function adminPage(value: string | null) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export function pageCount(total: number, pageSize = ADMIN_PAGE_SIZE) {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function adminRangeLabel(page: number, total: number, noun: string, pageSize = ADMIN_PAGE_SIZE) {
  if (total < 1) return '';
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);
  return `${start}–${end} of ${total} ${total === 1 ? noun : `${noun}s`}`;
}
