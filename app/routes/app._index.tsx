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
    </AdminShell>
  );
}
