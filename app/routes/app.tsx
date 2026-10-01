import {Outlet, useLoaderData} from 'react-router';
import '../styles/admin.css';
import {AppProvider as PolarisAppProvider} from '@shopify/polaris';
import polarisTranslations from '@shopify/polaris/locales/en.json';
import {AppProvider} from '@shopify/shopify-app-react-router/react';
import {NavMenu} from '@shopify/app-bridge-react';
import {authenticate} from '../shopify.server';
import {db} from '../db.server';
import {config} from '../config.server';
import {ensureShop} from '../lib/ensure-shop.server';

export async function loader({request}: {request: Request}) {
  const {session, admin} = await authenticate.admin(request);
  const shop = await ensureShop(session.shop);
  try {
    const response = await admin.graphql('#graphql query ShopIdentity { shop { id } }');
    const body = await response.json() as {data?: {shop?: {id?: string}}};
    if (body.data?.shop?.id) {
      await db.shop.update({
        where: {id: shop.id},
        data: {shopifyShopId: body.data.shop.id},
      });
    }
  } catch {
    // Billing and local features degrade to the Free plan until Shopify
    // identity synchronization succeeds.
  }
  return {shop: session.shop, apiKey: config.SHOPIFY_API_KEY};
}

export default function AppLayout() {
  const {shop, apiKey} = useLoaderData<typeof loader>();
  return (
    <AppProvider apiKey={apiKey}>
      <PolarisAppProvider i18n={polarisTranslations}>
        <NavMenu>
          <a href="/app" rel="home">Dashboard</a>
          <a href="/app/reviews">Reviews</a>
          <a href="/app/requests">Review Requests</a>
          <a href="/app/settings">Settings</a>
          <a href="/app/plan-usage">Plan &amp; usage</a>
        </NavMenu>
        <Outlet context={{shop}} />
      </PolarisAppProvider>
    </AppProvider>
  );
}
