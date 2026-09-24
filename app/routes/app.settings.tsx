import {Form, useActionData, useLoaderData} from 'react-router';
import {useState} from 'react';
import {Page, Card, FormLayout, TextField, Button, Banner} from '@shopify/polaris';
import {authenticate} from '../shopify.server';
import {db} from '../db.server';

export async function loader({request}: {request: Request}) {
  const {session} = await authenticate.admin(request);
  const shop = await db.shop.findUnique({where: {shopDomain: session.shop}, include: {settings: true}});
  return {primaryColor: shop?.settings?.primaryColor ?? '#2563eb'};
}

export async function action({request}: {request: Request}) {
  const {session} = await authenticate.admin(request);
  const formData = await request.formData();
  const primaryColor = String(formData.get('primaryColor') ?? '');
  if (!/^#[0-9a-f]{6}$/i.test(primaryColor)) {
    return {error: 'Primary color must be a six-digit hex color.'};
  }
  const shop = await db.shop.findUnique({where: {shopDomain: session.shop}});
  if (!shop) return {error: 'Shop is not initialized.'};
  await db.shopSettings.upsert({
    where: {shopId: shop.id},
    update: {primaryColor},
    create: {shopId: shop.id, primaryColor},
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
      <Card>
        <Form method="post">
          <FormLayout>
            <TextField label="Primary color" name="primaryColor" value={primaryColor} onChange={setPrimaryColor} autoComplete="off" />
            <Button submit variant="primary">Save settings</Button>
          </FormLayout>
        </Form>
      </Card>
    </Page>
  );
}
