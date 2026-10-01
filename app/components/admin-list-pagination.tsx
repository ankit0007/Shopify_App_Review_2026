import {Pagination} from '@shopify/polaris';
import {adminRangeLabel} from '../modules/admin/page';

export function AdminListPagination({
  page,
  pages,
  total,
  noun,
  previousUrl,
  nextUrl,
}: {
  page: number;
  pages: number;
  total: number;
  noun: string;
  previousUrl: string;
  nextUrl: string;
}) {
  if (total < 1) return null;
  return (
    <div className="admin-list-pagination">
      <Pagination
        type="table"
        hasPrevious={page > 1}
        hasNext={page < pages}
        previousURL={page > 1 ? previousUrl : undefined}
        nextURL={page < pages ? nextUrl : undefined}
        label={adminRangeLabel(page, total, noun)}
      />
      <style>{`
        .admin-list-pagination { margin-top: 16px; border: 1px solid #e3e3e3; border-radius: 12px; overflow: hidden; }
        .admin-list-pagination nav { width: 100%; }
      `}</style>
    </div>
  );
}
