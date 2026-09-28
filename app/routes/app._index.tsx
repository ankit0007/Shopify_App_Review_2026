import {useLoaderData} from 'react-router';
import {Page, Layout, Card, Text, BlockStack} from '@shopify/polaris';
import {authenticate} from '../shopify.server';
import {db} from '../db.server';
import {getReviewAnalytics} from '../modules/analytics/analytics.service.server';

export async function loader({request}: {request: Request}) {
  const {session} = await authenticate.admin(request);
  const shop = await db.shop.findUnique({where: {shopDomain: session.shop}, select: {id: true}});
  const analytics = shop ? await getReviewAnalytics(shop.id) : null;
  return {analytics};
}

export default function Dashboard() {
  const {analytics} = useLoaderData<typeof loader>();
  const ratingDistribution = analytics?.ratingDistribution ?? {1: 0, 2: 0, 3: 0, 4: 0, 5: 0};
  return (
    <Page title="Dashboard">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">Customer reviews</Text>
              <Text as="p">{analytics?.approved ?? 0} approved · {analytics?.pending ?? 0} waiting · {analytics?.rejected ?? 0} rejected</Text>
              <Text as="p">{analytics?.total ?? 0} total · {analytics?.verified ?? 0} verified · average {(analytics?.averageRating ?? 0).toFixed(1)} / 5</Text>
              <Text as="p">Ratings: 5★ {ratingDistribution[5]} · 4★ {ratingDistribution[4]} · 3★ {ratingDistribution[3]} · 2★ {ratingDistribution[2]} · 1★ {ratingDistribution[1]}</Text>
              <Text as="p">{analytics?.photoReviews ?? 0} photo reviews · {analytics?.videoReviews ?? 0} video reviews</Text>
              <Text as="p">
                {analytics?.requestConversion == null
                  ? 'Review-request conversion is not available yet.'
                  : `${Math.round(analytics.requestConversion * 100)}% of accepted review requests were submitted.`}
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
