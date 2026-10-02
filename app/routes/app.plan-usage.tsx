import {useLoaderData} from 'react-router';
import {AdminShell, Badge} from '../components/admin/ui';
import {authenticate} from '../shopify.server';
import {db} from '../db.server';
import {BillingService} from '../modules/billing/billing.service.server';

export async function loader({request}: {request: Request}) {
  const {session} = await authenticate.admin(request);
  const shop = await db.shop.findUnique({where: {shopDomain: session.shop}});
  if (!shop) throw new Response('Shop not found', {status: 404});
  const subscription = await new BillingService().getSubscriptionForShop(shop.id);
  const plan = subscription.plan;
  const periodStart = new Date();
  periodStart.setUTCDate(1);
  periodStart.setUTCHours(0, 0, 0, 0);
  const usage = await db.usageRecord.findMany({where: {shopId: shop.id, periodStart}});
  const used = new Map(usage.map((record) => [record.metric, record.quantity]));
  return {
    plan,
    status: subscription.status,
    metrics: [
      {label: 'Reviews', metric: 'reviews', used: used.get('reviews') ?? 0, limit: plan.limits.reviews},
      {label: 'Review requests', metric: 'requests', used: used.get('requests') ?? 0, limit: plan.limits.requests},
      {label: 'Media bytes', metric: 'mediaBytes', used: used.get('mediaBytes') ?? 0, limit: plan.limits.mediaBytes},
    ],
  };
}

export default function PlanUsage() {
  const {plan, status, metrics} = useLoaderData<typeof loader>();
  return (
    <AdminShell title="Plan & usage" subtitle={`Current plan: ${plan.name}`}>
      <section className="w-full min-w-0 rounded-xl border border-[#e3e3e3] bg-white p-4 sm:p-5">
        <Badge tone={status === 'active' ? 'success' : 'warning'}>{status}</Badge>
        <ul className="mt-4 grid gap-3 text-sm md:grid-cols-3">
          {metrics.map((metric) => (
            <li key={metric.metric} className="rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-4 py-3">
              <span className="block text-[#6d7175]">{metric.label}</span>
              <span className="mt-1 block text-base font-semibold">{metric.used} / {metric.limit}</span>
            </li>
          ))}
        </ul>
      </section>
    </AdminShell>
  );
}
