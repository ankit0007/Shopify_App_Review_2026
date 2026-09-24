import {Page, Card, ResourceList, ResourceItem, Text} from '@shopify/polaris';
import {authenticate} from '../shopify.server';

export async function loader({request}: {request: Request}) {
  await authenticate.admin(request);
  return {plan: 'Free', metrics: [{label: 'Reviews', used: 0, limit: 50}, {label: 'Review requests', used: 0, limit: 100}]};
}

export default function PlanUsage() {
  return (
    <Page title="Plan & Usage">
      <Card>
        <Text as="h2" variant="headingMd">Current plan: Free</Text>
        <ResourceList
          resourceName={{singular: 'metric', plural: 'metrics'}}
          items={[{id: 'reviews', label: 'Reviews', used: 0, limit: 50}, {id: 'requests', label: 'Review requests', used: 0, limit: 100}]}
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
