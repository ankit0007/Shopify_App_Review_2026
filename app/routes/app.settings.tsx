import {Form, useActionData, useLoaderData} from 'react-router';
import {useState} from 'react';
import {Page, Card, FormLayout, TextField, Button, Banner, Text} from '@shopify/polaris';
import {authenticate} from '../shopify.server';
import {db} from '../db.server';
import {isSameOrigin} from '../lib/csrf.server';
import {loadEnabledSmtp} from '../modules/email/delivery.server';

export async function loader({request}: {request: Request}) {
  const {session} = await authenticate.admin(request);
  const shop = await db.shop.findUnique({where: {shopDomain: session.shop}, include: {settings: true}});
  let emailReady = false;
  try {
    emailReady = Boolean(await loadEnabledSmtp());
  } catch {
    emailReady = false;
  }
  return {
    primaryColor: shop?.settings?.primaryColor ?? '#2563eb',
    showWriteReviewButton: shop?.settings?.showWriteReviewButton === true,
    automaticRequests: shop?.settings?.automaticRequests === true,
    emailReady,
  };
}

export async function action({request}: {request: Request}) {
  const {session} = await authenticate.admin(request);
  if (!isSameOrigin(request)) return {error: 'Request could not be verified.'};
  const formData = await request.formData();
  const primaryColor = String(formData.get('primaryColor') ?? '');
  if (!/^#[0-9a-f]{6}$/i.test(primaryColor)) {
    return {error: 'Primary color must be a six-digit hex color.'};
  }
  const shop = await db.shop.findUnique({where: {shopDomain: session.shop}});
  if (!shop) return {error: 'Shop is not initialized.'};
  await db.shopSettings.upsert({
    where: {shopId: shop.id},
    update: {
      primaryColor,
      showWriteReviewButton: formData.get('showWriteReviewButton') === 'true',
      automaticRequests: formData.get('automaticRequests') === 'true',
    },
    create: {
      shopId: shop.id,
      primaryColor,
      showWriteReviewButton: formData.get('showWriteReviewButton') === 'true',
      automaticRequests: formData.get('automaticRequests') === 'true',
    },
  });
  return {saved: true};
}

export default function Settings() {
  const settings = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const [primaryColor, setPrimaryColor] = useState(settings.primaryColor);
  return (
    <Page title="Settings">
      {result?.error ? <Banner tone="critical">{result.error}</Banner> : null}
      {result?.saved ? <Banner tone="success">Settings saved.</Banner> : null}
      {settings.automaticRequests && !settings.emailReady ? (
        <Banner tone="warning">Automatic review emails are on, but email delivery is not configured. Requests will be saved as failed until email is set up.</Banner>
      ) : null}
      <Card>
        <Form method="post">
          <FormLayout>
            <Text as="h2" variant="headingMd">Review settings</Text>
            <Text as="p" tone="subdued">Direct customer reviews</Text>
            <label>
              <input type="checkbox" name="showWriteReviewButton" value="true" defaultChecked={settings.showWriteReviewButton} />
              {' '}Show &quot;Write a Review&quot; button
            </label>
            <Text as="p" tone="subdued">When enabled, customers can manually open the review form from your storefront. Review requests sent after fulfillment are controlled separately.</Text>
            <Text as="p" tone="subdued">Automatic review requests</Text>
            <label>
              <input type="checkbox" name="automaticRequests" value="true" defaultChecked={settings.automaticRequests} />
              {' '}Email customers after fulfillment
            </label>
            <Text as="p" tone="subdued">Automatically email customers after their products are fulfilled and invite them to review each product.</Text>
            <TextField label="Primary color" name="primaryColor" value={primaryColor} onChange={setPrimaryColor} autoComplete="off" />
            <Button submit variant="primary">Save settings</Button>
          </FormLayout>
        </Form>
      </Card>
    </Page>
  );
}
