export const ADMIN_PAGE_SIZES = [10, 20, 50] as const;
export type AdminPageSize = (typeof ADMIN_PAGE_SIZES)[number];
export const ADMIN_PAGE_SIZE: AdminPageSize = 20;

export function adminPage(value: string | null) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export function adminPageSize(value: string | null): AdminPageSize {
  const size = Number(value);
  return (ADMIN_PAGE_SIZES as readonly number[]).includes(size) ? size as AdminPageSize : ADMIN_PAGE_SIZE;
}

export function pageCount(total: number, pageSize: number = ADMIN_PAGE_SIZE) {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function adminRangeLabel(page: number, total: number, noun: string, pageSize: number = ADMIN_PAGE_SIZE) {
  if (total < 1) return '';
  const safePage = Math.min(Math.max(1, page), pageCount(total, pageSize));
  const start = (safePage - 1) * pageSize + 1;
  const end = Math.min(total, safePage * pageSize);
  return `${start}–${end} of ${total} ${total === 1 ? noun : `${noun}s`}`;
}
