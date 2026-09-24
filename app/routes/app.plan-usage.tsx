import {Page, Card, ResourceList, ResourceItem, Text, Badge} from '@shopify/polaris';
import {useLoaderData} from 'react-router';
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
    <Page title="Plan & Usage">
      <Card>
        <Text as="h2" variant="headingMd">Current plan: {plan.name}</Text>
        <Badge tone={status === 'active' ? 'success' : 'attention'}>{status}</Badge>
        <ResourceList
          resourceName={{singular: 'metric', plural: 'metrics'}}
          items={metrics.map((metric) => ({...metric, id: metric.metric}))}
          renderItem={(item) => (
            <ResourceItem id={item.id} onClick={() => undefined}>
              <Text as="p">{item.label}: {item.used} / {item.limit}</Text>
            </ResourceItem>
          )}
        />
      </Card>
    </Page>
  );
}
