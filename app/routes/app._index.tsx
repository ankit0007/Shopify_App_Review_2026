import {useLoaderData} from 'react-router';
import {Page, Layout, Card, Text, BlockStack} from '@shopify/polaris';
import {authenticate} from '../shopify.server';
import {db} from '../db.server';

export async function loader({request}: {request: Request}) {
  const {session} = await authenticate.admin(request);
  const shop = await db.shop.findUnique({where: {shopDomain: session.shop}, select: {id: true}});
  const [pending, approved] = shop
    ? await Promise.all([
      db.review.count({where: {shopId: shop.id, status: 'PENDING', deletedAt: null}}),
      db.review.count({where: {shopId: shop.id, status: 'APPROVED', deletedAt: null}}),
    ])
    : [0, 0];
  return {pending, approved};
}

export default function Dashboard() {
  const {pending, approved} = useLoaderData<typeof loader>();
  return (
    <Page title="Dashboard">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">Customer reviews</Text>
              <Text as="p">{approved} approved · {pending} waiting for approval</Text>
              <Text as="p">Open Reviews to approve customer submissions. Approved reviews appear on the product page.</Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
