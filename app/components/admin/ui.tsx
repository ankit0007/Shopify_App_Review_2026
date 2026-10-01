import {NavLink, useSearchParams} from 'react-router';
import {useId, type ReactNode} from 'react';
import {embeddedFields, withEmbeddedQuery} from '../../lib/embedded-query';
import {formatAverage, starFills} from '../../modules/reviews/rating';

const STAR_PATH = 'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z';
const focus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#008060]';

const nav = [
  {to: '/app', label: 'Dashboard', end: true, icon: 'grid'},
  {to: '/app/reviews', label: 'Reviews', icon: 'star'},
  {to: '/app/requests', label: 'Review Requests', icon: 'mail'},
  {to: '/app/settings', label: 'Settings', icon: 'gear'},
  {to: '/app/plan-usage', label: 'Plan & usage', icon: 'card'},
] as const;

function useAdminHref() {
  const [params] = useSearchParams();
  return (href: string) => withEmbeddedQuery(href, params);
}

export function AdminLink({href, className, children}: {href: string; className?: string; children: ReactNode}) {
  const hrefFor = useAdminHref();
  return <a className={className} href={hrefFor(href)}>{children}</a>;
}

export function EmbeddedFields() {
  const [params] = useSearchParams();
  return embeddedFields(params).map((field) => <input key={field.key} type="hidden" name={field.key} value={field.value} />);
}

export function AdminShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const href = useAdminHref();
  return (
    <div className="min-h-screen bg-[#f6f6f7] text-[#202223]">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#008060]">Product Reviews</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
            {subtitle ? <p className="mt-1 max-w-2xl text-sm text-[#6d7175]">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </header>
        <nav aria-label="Product Reviews" className="mt-5 flex gap-1 overflow-x-auto border-b border-[#e3e3e3]">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={href(item.to)}
              end={'end' in item ? item.end : undefined}
              className={({isActive}) => `inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm font-semibold ${focus} ${isActive ? 'border-[#008060] text-[#008060]' : 'border-transparent text-[#6d7175] hover:text-[#202223]'}`}
            >
              <NavIcon name={item.icon} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

export function Card({title, action, children, className = ''}: {title?: string; action?: ReactNode; children: ReactNode; className?: string}) {
  return (
    <section className={`rounded-xl border border-[#e3e3e3] bg-white p-4 shadow-[0_1px_0_rgba(0,0,0,0.04)] sm:p-5 ${className}`}>
      {title || action ? (
        <div className="mb-4 flex items-start justify-between gap-3">
          {title ? <h2 className="text-base font-semibold">{title}</h2> : <span />}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Button({
  href,
  children,
  variant = 'primary',
  type = 'button',
  onClick,
  disabled,
}: {
  href?: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  type?: 'button' | 'submit';
  onClick?: () => void;
  disabled?: boolean;
}) {
  const hrefFor = useAdminHref();
  const className = `inline-flex min-h-10 items-center justify-center rounded-lg px-3 text-sm font-semibold ${focus} disabled:cursor-not-allowed disabled:opacity-60 ${
    variant === 'primary' ? 'bg-[#008060] text-white hover:bg-[#006e52]' :
    variant === 'danger' ? 'border border-[#d72c0d] bg-white text-[#d72c0d]' :
    variant === 'ghost' ? 'text-[#202223] hover:bg-[#f1f2f3]' :
    'border border-[#c9cccf] bg-white text-[#202223] hover:bg-[#f6f6f7]'
  }`;
  if (href) return <a className={className} href={hrefFor(href)}>{children}</a>;
  return <button className={className} type={type} onClick={onClick} disabled={disabled}>{children}</button>;
}

export function Badge({tone, children}: {tone: 'success' | 'warning' | 'critical' | 'info' | 'neutral'; children: ReactNode}) {
  const tones = {
    success: 'bg-[#e3f1df] text-[#0c5132]',
    warning: 'bg-[#fff5ea] text-[#8a6116]',
    critical: 'bg-[#fee9e8] text-[#8e1f0b]',
    info: 'bg-[#eaf4ff] text-[#00527c]',
    neutral: 'bg-[#f1f2f3] text-[#202223]',
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

export function EmptyState({title, children, action}: {title: string; children: ReactNode; action?: ReactNode}) {
  return (
    <div className="rounded-xl border border-dashed border-[#c9cccf] bg-white px-4 py-10 text-center">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-[#6d7175]">{children}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Skeleton({className = ''}: {className?: string}) {
  return <div className={`animate-pulse rounded-md bg-[#eceeef] ${className}`} />;
}

export function RatingStars({rating, label, size = 16}: {rating: number; label: string; size?: number}) {
  const fills = starFills(rating);
  const id = useId().replace(/:/g, '');
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={label}>
      {fills.map((fill, index) => (
        <svg key={index} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className="shrink-0">
          <defs>
            <clipPath id={`${id}-${index}`}>
              <rect x="0" y="0" width={24 * fill} height="24" />
            </clipPath>
          </defs>
          <path d={STAR_PATH} fill="#D9DDE3" />
          {fill > 0 ? <path d={STAR_PATH} fill="#F5B301" clipPath={`url(#${id}-${index})`} /> : null}
        </svg>
      ))}
    </span>
  );
}

export function ratingLabel(average: number | null, count: number) {
  return `Rated ${formatAverage(average) ?? '0.0'} out of 5 stars from ${count} ${count === 1 ? 'review' : 'reviews'}`;
}

export function ProgressBar({value, label}: {value: number; label: string}) {
  const width = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#eceeef]" role="img" aria-label={label}>
      <div className="h-full rounded-full bg-[#F5B301]" style={{width: `${width}%`}} />
    </div>
  );
}

export function PaginationFooter({
  label,
  page,
  pages,
  previousUrl,
  nextUrl,
  firstUrl,
  lastUrl,
}: {
  label: string;
  page: number;
  pages: number;
  previousUrl: string | null;
  nextUrl: string | null;
  firstUrl?: string | null;
  lastUrl?: string | null;
}) {
  return (
    <nav aria-label="Pagination" className="mt-4 flex flex-col gap-3 rounded-xl border border-[#e3e3e3] bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-[#6d7175]">{label || 'No results'}</p>
      <div className="flex flex-wrap items-center gap-2">
        <PageLink href={firstUrl} label="First page" disabled={!firstUrl || page <= 1}>First</PageLink>
        <PageLink href={previousUrl} label="Previous page" disabled={!previousUrl || page <= 1}>Previous</PageLink>
        <span className="px-1 text-sm font-semibold" aria-current="page">Page {page} of {pages}</span>
        <PageLink href={nextUrl} label="Next page" disabled={!nextUrl || page >= pages}>Next</PageLink>
        <PageLink href={lastUrl} label="Last page" disabled={!lastUrl || page >= pages}>Last</PageLink>
      </div>
    </nav>
  );
}

function PageLink({href, label, disabled, children}: {href?: string | null; label: string; disabled: boolean; children: ReactNode}) {
  const hrefFor = useAdminHref();
  if (disabled || !href) {
    return <span aria-disabled="true" className="inline-flex min-h-10 items-center rounded-lg border border-[#e3e3e3] px-3 text-sm font-semibold text-[#8c9196]">{children}<span className="sr-only"> {label}</span></span>;
  }
  return <a href={hrefFor(href)} aria-label={label} className={`inline-flex min-h-10 items-center rounded-lg border border-[#c9cccf] bg-white px-3 text-sm font-semibold ${focus}`}>{children}</a>;
}

function NavIcon({name}: {name: string}) {
  const common = {width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, 'aria-hidden': true as const};
  if (name === 'star') return <svg {...common}><path d={STAR_PATH} fill="currentColor" stroke="none" /></svg>;
  if (name === 'mail') return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 7 9-7" /></svg>;
  if (name === 'gear') return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" /></svg>;
  if (name === 'card') return <svg {...common}><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18" /></svg>;
  return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>;
}

export function statusTone(status: string): 'success' | 'warning' | 'critical' | 'info' | 'neutral' {
  if (status === 'APPROVED' || status === 'SENT' || status === 'SUBMITTED') return 'success';
  if (status === 'PENDING' || status === 'SCHEDULED' || status === 'SENDING') return 'warning';
  if (status === 'REJECTED' || status === 'FAILED' || status === 'CANCELLED' || status === 'BLOCKED') return 'critical';
  if (status === 'OPENED' || status === 'CLICKED') return 'info';
  return 'neutral';
}
