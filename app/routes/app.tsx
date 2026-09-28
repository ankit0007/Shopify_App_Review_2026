import {Outlet, useLoaderData} from 'react-router';
import {NavMenu} from '@shopify/app-bridge-react';
import {authenticate} from '../shopify.server';
import {ensureShop} from '../lib/ensure-shop.server';

export async function loader({request}: {request: Request}) {
  const {session} = await authenticate.admin(request);
  await ensureShop(session.shop);
  return {shop: session.shop};
}

export default function AppLayout() {
  const {shop} = useLoaderData<typeof loader>();
  return (
    <>
      <NavMenu>
        <a href="/app" rel="home">Dashboard</a>
        <a href="/app/reviews">Reviews</a>
        <a href="/app/settings">Settings</a>
        <a href="/app/plan-usage">Plan &amp; Usage</a>
      </NavMenu>
      <Outlet context={{shop}} />
    </>
  );
}
