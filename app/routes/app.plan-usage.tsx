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
      <section className="max-w-xl rounded-xl border border-[#e3e3e3] bg-white p-4">
        <Badge tone={status === 'active' ? 'success' : 'warning'}>{status}</Badge>
        <ul className="mt-4 grid gap-2 text-sm">
          {metrics.map((metric) => (
            <li key={metric.metric} className="flex justify-between border-b border-[#f1f2f3] py-2">
              <span>{metric.label}</span>
              <span className="font-semibold">{metric.used} / {metric.limit}</span>
            </li>
          ))}
        </ul>
      </section>
    </AdminShell>
  );
}
