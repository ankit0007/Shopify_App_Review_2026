import {adminRangeLabel} from '../modules/admin/page';
import {PaginationFooter} from './admin/ui';

export function AdminListPagination({
  page,
  pages,
  total,
  noun,
  pageSize,
  previousUrl,
  nextUrl,
  firstUrl,
  lastUrl,
}: {
  page: number;
  pages: number;
  total: number;
  noun: string;
  pageSize?: number;
  previousUrl: string | null;
  nextUrl: string | null;
  firstUrl?: string | null;
  lastUrl?: string | null;
}) {
  if (total < 1) return null;
  return (
    <PaginationFooter
      label={adminRangeLabel(page, total, noun, pageSize)}
      page={page}
      pages={pages}
      previousUrl={previousUrl}
      nextUrl={nextUrl}
      firstUrl={firstUrl}
      lastUrl={lastUrl}
    />
  );
}
