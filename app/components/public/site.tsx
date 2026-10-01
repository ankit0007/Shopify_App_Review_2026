import type {ReactNode} from 'react';
import {NavLink, useOutletContext} from 'react-router';

export const PUBLIC_ORIGIN = 'https://productreviews.it3.in';
export const SUPPORT_EMAIL = 'info@artifyanni.com';

export function publicMeta(input: {title: string; description: string; path: string}) {
  const url = `${PUBLIC_ORIGIN}${input.path}`;
  return [
    {title: input.title},
    {name: 'description', content: input.description},
    {tagName: 'link', rel: 'canonical', href: url},
    {property: 'og:title', content: input.title},
    {property: 'og:description', content: input.description},
    {property: 'og:url', content: url},
    {property: 'og:type', content: 'website'},
    {name: 'robots', content: 'index, follow'},
  ];
}

const headerLinks = [
  ['/', 'Home'],
  ['/faq', 'FAQ'],
  ['/tutorial', 'Tutorial'],
  ['/docs', 'Documentation'],
  ['/docs#billing', 'Pricing'],
  ['/changelog', 'Changelog'],
  ['/privacy', 'Privacy'],
  ['/support', 'Support'],
] as const;

export function useSupportEmail() {
  return useOutletContext<{supportEmail: string | null}>().supportEmail;
}

export function PublicSite({children}: {children: ReactNode}) {
  const supportEmail = useSupportEmail();
  return (
    <div className="pr-site">
      <header className="pr-header">
        <div className="pr-bar">
          <a className="pr-brand" href="/">Product Reviews</a>
          <nav className="pr-nav" aria-label="Public">
            {headerLinks.map(([href, label]) => (
              <NavLink key={href} to={href} end={href === '/'}>{label}</NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="pr-main">{children}</main>
      <footer className="pr-footer">
        <div className="pr-footer-inner">
          <nav className="pr-footer-nav" aria-label="Footer">
            <a href="/privacy">Privacy Policy</a>
            <a href="/faq">FAQ</a>
            <a href="/docs">Documentation</a>
            <a href="/tutorial">Tutorial</a>
            <a href="/changelog">Changelog</a>
            <a href={`mailto:${supportEmail ?? SUPPORT_EMAIL}`}>Support</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

export function SupportContact() {
  const supportEmail = useSupportEmail() ?? SUPPORT_EMAIL;
  return <p>Support email: <a href={`mailto:${supportEmail}`}>{supportEmail}</a></p>;
}
