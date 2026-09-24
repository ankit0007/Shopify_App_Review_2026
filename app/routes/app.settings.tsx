import {Form, useActionData} from 'react-router';
import {useState} from 'react';
import {Page, Card, FormLayout, TextField, Button, Banner} from '@shopify/polaris';
import {authenticate} from '../shopify.server';

export async function loader({request}: {request: Request}) {
  await authenticate.admin(request);
  return null;
}

export async function action({request}: {request: Request}) {
  await authenticate.admin(request);
  const formData = await request.formData();
  const primaryColor = String(formData.get('primaryColor') ?? '');
  if (!/^#[0-9a-f]{6}$/i.test(primaryColor)) {
    return {error: 'Primary color must be a six-digit hex color.'};
  }
  return {saved: true};
}

export default function Settings() {
  const result = useActionData<typeof action>();
  const [primaryColor, setPrimaryColor] = useState('#2563eb');
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
