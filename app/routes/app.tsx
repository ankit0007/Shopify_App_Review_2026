import {Outlet, useLoaderData} from 'react-router';
import {AppProvider as PolarisAppProvider} from '@shopify/polaris';
import polarisTranslations from '@shopify/polaris/locales/en.json';
import {AppProvider} from '@shopify/shopify-app-react-router/react';
import {NavMenu} from '@shopify/app-bridge-react';
import {authenticate} from '../shopify.server';
import {config} from '../config.server';
import {ensureShop} from '../lib/ensure-shop.server';

export async function loader({request}: {request: Request}) {
  const {session} = await authenticate.admin(request);
  await ensureShop(session.shop);
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
          <a href="/app/settings">Settings</a>
          <a href="/app/plan-usage">Plan &amp; Usage</a>
        </NavMenu>
        <Outlet context={{shop}} />
      </PolarisAppProvider>
    </AppProvider>
  );
}
