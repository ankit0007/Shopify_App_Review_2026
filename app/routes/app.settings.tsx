import {Form, useActionData, useLoaderData, useNavigation} from 'react-router';
import {useRef, useState} from 'react';
import {AdminShell} from '../components/admin/ui';
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
    <AdminShell title="Settings" subtitle="Control review requests, the storefront button, and appearance.">
      <SettingsForm
        key={`${settings.showWriteReviewButton}:${settings.automaticRequests}:${settings.requestDelayDays}:${settings.primaryColor}`}
        settings={settings}
        result={result}
        saving={navigation.state === 'submitting'}
      />
    </AdminShell>
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
    <Form method="post" ref={formRef} className="grid max-w-3xl gap-4">
      <input type="hidden" name="showWriteReviewButton" value={showWriteReviewButton ? 'true' : 'false'} />
      <input type="hidden" name="automaticRequests" value={automaticRequests ? 'true' : 'false'} />
      <input type="hidden" name="requestDelayDays" value={requestDelayDays} />
      <input type="hidden" name="primaryColor" value={primaryColor} />
      {result?.error ? <p className="rounded-lg bg-[#fee9e8] px-3 py-2 text-sm text-[#8e1f0b]" role="alert">{result.error}</p> : null}
      {result?.saved ? <p className="rounded-lg bg-[#e3f1df] px-3 py-2 text-sm text-[#0c5132]" role="status">Settings saved.</p> : null}
      {automaticRequests && !settings.emailReady ? (
        <p className="rounded-lg bg-[#fff5ea] px-3 py-2 text-sm text-[#8a6116]" role="status">Automatic review emails are on, but email delivery is not configured. Requests will be saved as failed until email is set up.</p>
      ) : null}
      <section className="rounded-xl border border-[#e3e3e3] bg-white p-4">
        <h2 className="text-base font-semibold">Storefront review button</h2>
        <p className="mt-1 text-sm text-[#6d7175]">Customers can still submit reviews from a review-request email when this button is hidden.</p>
        <label className="mt-3 flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={showWriteReviewButton} onChange={(event) => setShowWriteReviewButton(event.currentTarget.checked)} />
          <span>Show &quot;Write a review&quot; button. When disabled, the product page does not show a button that opens the review form.</span>
        </label>
      </section>
      <section className="rounded-xl border border-[#e3e3e3] bg-white p-4">
        <h2 className="text-base font-semibold">Review requests</h2>
        <p className="mt-1 text-sm text-[#6d7175]">One email is sent after the latest fulfillment, once the delay has passed.</p>
        <label className="mt-3 flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={automaticRequests} onChange={(event) => setAutomaticRequests(event.currentTarget.checked)} />
          <span>Automatic review-request emails. Customers are emailed after their products are fulfilled.</span>
        </label>
        {automaticRequests ? (
          <label className="mt-3 grid gap-1 text-sm font-semibold">
            Send review request after fulfillment
            <select className="min-h-10 rounded-lg border border-[#c9cccf] px-2 font-normal" value={requestDelayDays} onChange={(event) => setRequestDelayDays(event.currentTarget.value)}>
              {REVIEW_DELAY_DAYS.map((days) => <option key={days} value={days}>{days} days</option>)}
            </select>
          </label>
        ) : <p className="mt-3 text-sm text-[#6d7175]">Turn automatic emails on to choose when the request is sent.</p>}
      </section>
      <section className="rounded-xl border border-[#e3e3e3] bg-white p-4">
        <h2 className="text-base font-semibold">Appearance</h2>
        <label className="mt-3 grid gap-1 text-sm font-semibold">
          Primary color
          <input className="min-h-10 rounded-lg border border-[#c9cccf] px-3 font-normal" value={primaryColor} onChange={(event) => setPrimaryColor(event.currentTarget.value)} autoComplete="off" />
        </label>
        <p className="mt-1 text-sm text-[#6d7175]">Six-digit hex color, for example #2563eb.</p>
      </section>
      <button type="submit" className="min-h-10 w-fit rounded-lg bg-[#008060] px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={saving}>
        {saving ? 'Saving…' : 'Save settings'}
      </button>
    </Form>
  );
}
