import {Form, useActionData, useLoaderData, useNavigation} from 'react-router';
import {useRef, useState} from 'react';
import {Page, Card, Layout, Checkbox, Select, TextField, Button, Banner, BlockStack, Text, Box} from '@shopify/polaris';
import {authenticate} from '../shopify.server';
import {db} from '../db.server';
import {isSameOrigin} from '../lib/csrf.server';
import {loadEnabledSmtp} from '../modules/email/delivery.server';
import {normalizeReviewDelayDays, REVIEW_DELAY_DAYS, reviewRequestDelayDays} from '../modules/commerce/fulfillment-lines';

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
    requestDelayDays: String(normalizeReviewDelayDays(shop?.settings?.requestDelayDays)),
    emailReady,
  };
}

export async function action({request}: {request: Request}) {
  const {session} = await authenticate.admin(request);
  if (!isSameOrigin(request)) return {error: 'Request could not be verified.'};
  const formData = await request.formData();
  const primaryColor = String(formData.get('primaryColor') ?? '').trim();
  if (!/^#[0-9a-f]{6}$/i.test(primaryColor)) {
    return {error: 'Primary color must be a six-digit hex color.'};
  }
  const shop = await db.shop.findUnique({where: {shopDomain: session.shop}});
  if (!shop) return {error: 'Shop is not initialized.'};
  const requestDelayDays = reviewRequestDelayDays(formData.get('requestDelayDays'));
  if (!requestDelayDays) return {error: 'Choose a delay from 2 to 10 days.'};
  await db.shopSettings.upsert({
    where: {shopId: shop.id},
    update: {
      primaryColor,
      showWriteReviewButton: formData.get('showWriteReviewButton') === 'true',
      automaticRequests: formData.get('automaticRequests') === 'true',
      requestDelayDays,
    },
    create: {
      shopId: shop.id,
      primaryColor,
      showWriteReviewButton: formData.get('showWriteReviewButton') === 'true',
      automaticRequests: formData.get('automaticRequests') === 'true',
      requestDelayDays,
    },
  });
  return {saved: true};
}

export default function Settings() {
  const settings = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const navigation = useNavigation();
  return (
    <SettingsForm
      key={`${settings.showWriteReviewButton}:${settings.automaticRequests}:${settings.requestDelayDays}:${settings.primaryColor}`}
      settings={settings}
      result={result}
      saving={navigation.state === 'submitting'}
    />
  );
}

function SettingsForm({
  settings,
  result,
  saving,
}: {
  settings: ReturnType<typeof useLoaderData<typeof loader>>;
  result: ReturnType<typeof useActionData<typeof action>>;
  saving: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [showWriteReviewButton, setShowWriteReviewButton] = useState(settings.showWriteReviewButton);
  const [automaticRequests, setAutomaticRequests] = useState(settings.automaticRequests);
  const [requestDelayDays, setRequestDelayDays] = useState(settings.requestDelayDays);
  const [primaryColor, setPrimaryColor] = useState(settings.primaryColor);
  return (
    <Page
      title="Settings"
      primaryAction={{content: 'Save settings', loading: saving, onAction: () => formRef.current?.requestSubmit()}}
    >
      <Form method="post" ref={formRef}>
        <input type="hidden" name="showWriteReviewButton" value={showWriteReviewButton ? 'true' : 'false'} />
        <input type="hidden" name="automaticRequests" value={automaticRequests ? 'true' : 'false'} />
        <input type="hidden" name="requestDelayDays" value={requestDelayDays} />
        <input type="hidden" name="primaryColor" value={primaryColor} />
        <BlockStack gap="400">
          {result?.error ? <Banner tone="critical">{result.error}</Banner> : null}
          {result?.saved ? <Banner tone="success">Settings saved.</Banner> : null}
          {automaticRequests && !settings.emailReady ? (
            <Banner tone="warning">Automatic review emails are on, but email delivery is not configured. Requests will be saved as failed until email is set up.</Banner>
          ) : null}
          <Layout>
            <Layout.AnnotatedSection
              title="Storefront review button"
              description="Customers can still submit reviews from a review-request email when this button is hidden."
            >
              <Card>
                <Checkbox
                  label='Show "Write a review" button'
                  checked={showWriteReviewButton}
                  onChange={setShowWriteReviewButton}
                  helpText="When disabled, the product page does not show a button that opens the review form."
                />
              </Card>
            </Layout.AnnotatedSection>
            <Layout.AnnotatedSection
              title="Review requests"
              description="One email is sent after the latest fulfillment, once the delay has passed."
            >
              <Card>
                <BlockStack gap="400">
                  <Checkbox
                    label="Automatic review-request emails"
                    checked={automaticRequests}
                    onChange={setAutomaticRequests}
                    helpText="Automatically email customers after their products are fulfilled and invite them to review each product."
                  />
                  {automaticRequests ? (
                    <Select
                      label="Send review request after fulfillment"
                      options={REVIEW_DELAY_DAYS.map((days) => ({label: `${days} days`, value: String(days)}))}
                      value={requestDelayDays}
                      onChange={setRequestDelayDays}
                    />
                  ) : (
                    <Text as="p" tone="subdued">Turn automatic emails on to choose when the request is sent.</Text>
                  )}
                </BlockStack>
              </Card>
            </Layout.AnnotatedSection>
            <Layout.AnnotatedSection title="Appearance" description="Used for review accents in the admin.">
              <Card>
                <TextField
                  label="Primary color"
                  value={primaryColor}
                  onChange={setPrimaryColor}
                  autoComplete="off"
                  helpText="Six-digit hex color, for example #2563eb."
                />
              </Card>
            </Layout.AnnotatedSection>
          </Layout>
          <Box>
            <Button variant="primary" submit loading={saving}>Save settings</Button>
          </Box>
        </BlockStack>
      </Form>
    </Page>
  );
}
