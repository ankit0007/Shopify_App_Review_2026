import {useNavigation, useRevalidator, useLoaderData} from 'react-router';
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
      <section className="mt-4 max-w-3xl rounded-xl border border-[#e3e3e3] bg-white p-4">
        <h2 className="text-base font-semibold">Add reviews to your product page</h2>
        <ol className="mt-3 grid gap-2 pl-5 text-sm text-[#3d4246]">
          <li>Open your Shopify admin and go to Online Store → Themes.</li>
          <li>Choose the theme you want to customize, then open its theme editor.</li>
          <li>Open the product template and choose Add section or Add block from the Apps section.</li>
          <li>Select Product reviews, position it where you want, and configure its display settings.</li>
          <li>Save or publish the theme, then open a product page with approved reviews to verify the result.</li>
        </ol>
        <p className="mt-3 text-sm text-[#6d7175]">The Product reviews block uses the app’s existing approved-review data. A storefront submission remains pending until it is approved.</p>
      </section>
    </AdminShell>
  );
}
