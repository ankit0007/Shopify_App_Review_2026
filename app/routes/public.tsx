import {Outlet, useLoaderData} from 'react-router';
import publicStyles from '../styles/public.css?url';

function configuredSupportEmail() {
  const value = process.env.SUPPORT_EMAIL?.trim() ?? '';
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(value) ? value : null;
}

export function loader() {
  return {supportEmail: configuredSupportEmail()};
}

export function links() {
  return [{rel: 'stylesheet', href: publicStyles}];
}

export function meta() {
  return [{name: 'viewport', content: 'width=device-width, initial-scale=1'}];
}

export default function PublicLayout() {
  const {supportEmail} = useLoaderData<typeof loader>();
  return <Outlet context={{supportEmail}} />;
}
