import {useNavigation, useOutletContext, useRevalidator, useLoaderData} from 'react-router';
import {authenticate} from '../shopify.server';
import {db} from '../db.server';
import {loadAdminDashboard} from '../modules/admin/dashboard.server';
import {AdminShell, Button} from '../components/admin/ui';
import {DashboardSkeleton, DashboardView} from '../components/admin/dashboard-view';

export async function loader({request}: {request: Request}) {
  const {session} = await authenticate.admin(request);
  const shop = await db.shop.findUnique({where: {shopDomain: session.shop}, select: {id: true}});
  const dashboard = shop ? await loadAdminDashboard(shop.id) : null;
  return {dashboard, loadedAt: new Date().toISOString()};
}

export default function Dashboard() {
  const {dashboard, loadedAt} = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const loading = navigation.state === 'loading' && navigation.location?.pathname === '/app';
  return (
    <AdminShell
      title="Dashboard"
      subtitle="Monitor customer feedback, ratings, and review performance."
      actions={(
        <>
          <Button variant="secondary" onClick={() => revalidator.revalidate()} disabled={revalidator.state === 'loading'}>Refresh</Button>
          <Button href="/app/settings" variant="secondary">Settings</Button>
        </>
      )}
    >
      {loading ? <DashboardSkeleton /> : dashboard ? <DashboardView data={dashboard} loadedAt={loadedAt} /> : (
        <p className="text-sm text-[#6d7175]">No reviews yet. Once customers submit reviews, your review analytics will appear here.</p>
      )}
      <StorefrontSetup />
    </AdminShell>
  );
}

function themeEditorUrl(shop: string, apiKey: string, query: string) {
  const store = shop.replace(/\.myshopify\.com$/i, '');
  return `https://admin.shopify.com/store/${encodeURIComponent(store)}/themes/current/editor?${query}`;
}

function StorefrontSetup() {
  const {shop, apiKey} = useOutletContext<{shop?: string; apiKey?: string}>();
  const embed = shop && apiKey ? themeEditorUrl(shop, apiKey, `context=apps&activateAppId=${encodeURIComponent(`${apiKey}/reviews-button`)}`) : '';
  const block = shop && apiKey ? themeEditorUrl(shop, apiKey, `template=product&addAppBlockId=${encodeURIComponent(`${apiKey}/review-summary`)}&target=newAppsSection`) : '';
  return (
    <section className="mt-4 max-w-3xl rounded-xl border border-[#e3e3e3] bg-white p-4">
      <h2 className="text-base font-semibold">Add Product Reviews to your theme</h2>
      <p className="mt-2 text-sm text-[#6d7175]">The Reviews button stays off until you enable the app embed. It also stays off when the Reviews button setting in this app is turned off.</p>
      <h3 className="mt-4 text-sm font-semibold">Floating Reviews button</h3>
      <ol className="mt-2 grid gap-2 pl-5 text-sm text-[#3d4246]">
        <li>Open Shopify Admin and go to Online Store → Themes.</li>
        <li>Click Customize on the theme you want to update.</li>
        <li>Open App embeds.</li>
        <li>Enable Product Reviews.</li>
        <li>Save the theme.</li>
        <li>Return here and open Settings to set the button position, orientation, and offsets.</li>
      </ol>
      {embed ? <a className="mt-3 inline-flex text-sm font-medium text-[#005bd3]" href={embed} target="_top">Open App embeds</a> : null}
      <h3 className="mt-4 text-sm font-semibold">Product page reviews</h3>
      <ol className="mt-2 grid gap-2 pl-5 text-sm text-[#3d4246]">
        <li>Open Online Store → Themes and click Customize.</li>
        <li>Open the product template.</li>
        <li>Click Add block or Add section.</li>
        <li>Select Apps, then Product reviews.</li>
        <li>Position the block and save the theme.</li>
      </ol>
      {block ? <a className="mt-3 inline-flex text-sm font-medium text-[#005bd3]" href={block} target="_top">Add the Product reviews block</a> : null}
    </section>
  );
}
