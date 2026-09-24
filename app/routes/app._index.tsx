import {Page, Layout, Card, Text, BlockStack} from '@shopify/polaris';
import {authenticate} from '../shopify.server';

export async function loader({request}: {request: Request}) {
  await authenticate.admin(request);
  return null;
}

export default function Dashboard() {
  return (
    <Page title="Dashboard">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">Review performance</Text>
              <Text as="p">Your review collection workspace is ready to configure.</Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
