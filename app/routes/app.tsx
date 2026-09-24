import {Outlet, useLoaderData} from 'react-router';
import {NavMenu} from '@shopify/app-bridge-react';
import {authenticate} from '../shopify.server';
import {db} from '../db.server';

export async function loader({request}: {request: Request}) {
  const {session} = await authenticate.admin(request);
  const shop = await db.shop.upsert({
    where: {shopDomain: session.shop},
    update: {uninstalledAt: null},
    create: {shopDomain: session.shop},
  });
  await db.shopSettings.upsert({
    where: {shopId: shop.id},
    update: {},
    create: {shopId: shop.id},
  });
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
