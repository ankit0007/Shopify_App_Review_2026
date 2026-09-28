import {useLoaderData} from 'react-router';
import {Page, Layout, Card, Text, BlockStack} from '@shopify/polaris';
import {authenticate} from '../shopify.server';
import {db} from '../db.server';
import {getReviewAnalytics} from '../modules/analytics/analytics.service.server';

export async function loader({request}: {request: Request}) {
  const {session} = await authenticate.admin(request);
  const shop = await db.shop.findUnique({where: {shopDomain: session.shop}, select: {id: true}});
  const analytics = shop ? await getReviewAnalytics(shop.id) : {pending: 0, approved: 0, total: 0, verified: 0, averageRating: 0};
  const requests = shop ? await db.reviewRequest.count({where: {shopId: shop.id}}) : 0;
  return {...analytics, requests};
}

export default function Dashboard() {
  const {pending, approved, total, verified, averageRating, requests} = useLoaderData<typeof loader>();
  return (
    <Page title="Dashboard">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">Customer reviews</Text>
              <Text as="p">{approved} approved · {pending} waiting for approval</Text>
              <Text as="p">{total} total · {verified} verified · average {averageRating.toFixed(1)} / 5</Text>
              <Text as="p">{requests} review requests</Text>
              <Text as="p">Open Reviews to approve customer submissions. Approved reviews appear on the product page.</Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
