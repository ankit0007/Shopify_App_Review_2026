import type {LinksFunction} from 'react-router';
import {Links, Meta, Outlet, Scripts, ScrollRestoration, useRouteError, isRouteErrorResponse} from 'react-router';
import polarisStyles from '@shopify/polaris/build/esm/styles.css?url';

export const links: LinksFunction = () => [{rel: 'stylesheet', href: polarisStyles}];

export const headers = () => ({
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Content-Type-Options': 'nosniff',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': "frame-ancestors https://admin.shopify.com https://*.myshopify.com;",
  'Cache-Control': 'no-store',
});

export default function App() {
  return (
    <html lang="en">
      <head>
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error) ? error.statusText : 'Unexpected application error';
  return <main><h1>{message}</h1><p>Please try again or contact support.</p></main>;
}
