import {Form, useActionData, useLoaderData, useNavigation} from 'react-router';
import {useRef, useState} from 'react';
import {AdminShell, ToggleSwitch} from '../components/admin/ui';
import {authenticate} from '../shopify.server';
import {db} from '../db.server';
import {isSameOrigin} from '../lib/csrf.server';
import {loadEnabledSmtp} from '../modules/email/delivery.server';
import {normalizeReviewDelayDays, REVIEW_DELAY_DAYS, reviewEmailTrigger, reviewRequestDelayDays} from '../modules/commerce/fulfillment-lines';
import {REVIEW_BUTTON_ORIENTATIONS, REVIEW_BUTTON_POSITIONS, reviewButtonPreviewStyle, type ReviewButtonOrientation, type ReviewButtonPosition} from '../modules/reviews/reviews-button';

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
    reviewsButtonEnabled: shop?.settings?.reviewsButtonEnabled ?? shop?.settings?.showAllReviewsTab !== false,
    showAllReviewsTab: shop?.settings?.showAllReviewsTab !== false,
    automaticRequests: shop?.settings?.automaticRequests === true,
    reviewRequestTrigger: reviewEmailTrigger(shop?.settings?.reviewRequestTrigger),
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
  const reviewsButtonEnabled = formData.get('reviewsButtonEnabled') === 'true';
  const requestDelayDays = reviewRequestDelayDays(formData.get('requestDelayDays'));
  if (!requestDelayDays) return {error: 'Choose a delay from 2 to 10 days.'};
  const reviewRequestTrigger = reviewEmailTrigger(formData.get('reviewRequestTrigger'));
  if (formData.get('reviewRequestTrigger') !== 'FULFILLMENT' && formData.get('reviewRequestTrigger') !== 'PAID') {
    return {error: 'Choose whether review emails start after fulfillment or after payment.'};
  }
  await db.shopSettings.upsert({
    where: {shopId: shop.id},
    update: {
      primaryColor,
      showAllReviewsTab: reviewsButtonEnabled,
      reviewsButtonEnabled,
      automaticRequests: formData.get('automaticRequests') === 'true',
      reviewRequestTrigger,
      requestDelayDays,
    },
    create: {
      shopId: shop.id,
      primaryColor,
      showAllReviewsTab: reviewsButtonEnabled,
      reviewsButtonEnabled,
      automaticRequests: formData.get('automaticRequests') === 'true',
      reviewRequestTrigger,
      requestDelayDays,
    },
  });
  return {saved: true};
}

export default function Settings() {
  const settings = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const navigation = useNavigation();
  const saving = navigation.state === 'submitting';
  return (
    <AdminShell
      title="Settings"
      subtitle="Control the storefront Reviews button, review display, review requests, and appearance."
      actions={(
        <button form="settings-form" type="submit" className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#008060] px-4 text-sm font-semibold text-white hover:bg-[#006e52] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#008060] disabled:opacity-60" disabled={saving}>
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      )}
    >
      <SettingsForm
        key={`${settings.reviewsButtonEnabled}:${settings.automaticRequests}:${settings.reviewRequestTrigger}:${settings.requestDelayDays}:${settings.primaryColor}`}
        settings={settings}
        result={result}
        saving={saving}
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
  const [reviewsButtonEnabled, setReviewsButtonEnabled] = useState(settings.reviewsButtonEnabled);
  const [automaticRequests, setAutomaticRequests] = useState(settings.automaticRequests);
  const [reviewRequestTrigger, setReviewRequestTrigger] = useState(settings.reviewRequestTrigger);
  const [requestDelayDays, setRequestDelayDays] = useState(settings.requestDelayDays);
  const [primaryColor, setPrimaryColor] = useState(settings.primaryColor);
  return (
    <Form id="settings-form" method="post" ref={formRef} className="grid w-full min-w-0 gap-5">
      <input type="hidden" name="reviewsButtonEnabled" value={reviewsButtonEnabled ? 'true' : 'false'} />
      <input type="hidden" name="automaticRequests" value={automaticRequests ? 'true' : 'false'} />
      <input type="hidden" name="reviewRequestTrigger" value={reviewRequestTrigger} />
      <input type="hidden" name="requestDelayDays" value={requestDelayDays} />
      <input type="hidden" name="primaryColor" value={primaryColor} />
      {result?.error ? <p className="rounded-lg bg-[#fee9e8] px-3 py-2 text-sm text-[#8e1f0b]" role="alert">{result.error}</p> : null}
      {result?.saved ? <p className="rounded-lg bg-[#e3f1df] px-3 py-2 text-sm text-[#0c5132]" role="status">Settings saved.</p> : null}
      {!settings.emailReady ? (
        <p className="rounded-lg bg-[#fff5ea] px-3 py-2 text-sm text-[#8a6116]" role="alert">SMTP is not configured. Configure SMTP before sending review-request emails.</p>
      ) : null}
      <section className="rounded-xl border border-[#e3e3e3] bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold">Reviews Button</h2>
        <p className="mt-1 text-sm text-[#6d7175]">Control the store-wide Reviews button.</p>
        <div className="mt-4">
          <ToggleSwitch
            label="Enable Reviews Button"
            description="The button is shown only after Product Reviews is enabled under Online Store → Themes → Customize → App embeds."
            checked={reviewsButtonEnabled}
            onChange={setReviewsButtonEnabled}
          />
        </div>
        {!reviewsButtonEnabled ? <p className="mt-4 text-sm text-[#6d7175]">Turn the Reviews button on to show it on the storefront.</p> : null}
      </section>
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-[#e3e3e3] bg-white p-4 sm:p-5">
          <h2 className="text-base font-semibold">Review requests</h2>
          <p className="mt-1 text-sm text-[#6d7175]">One email covers every product in the order. The customer reviews them together on one page.</p>
          <div className="mt-4">
            <ToggleSwitch
              label="Automatic review-request emails"
              checked={automaticRequests}
              onChange={setAutomaticRequests}
            />
          </div>
          <div className="mt-4 grid gap-3">
            <label className="grid gap-1 text-sm font-semibold">
              Send the review email when
              <select className="min-h-10 w-full rounded-lg border border-[#c9cccf] bg-white px-2 font-normal" value={reviewRequestTrigger} onChange={(event) => setReviewRequestTrigger(event.currentTarget.value === 'PAID' ? 'PAID' : 'FULFILLMENT')}>
                <option value="FULFILLMENT">The order is fulfilled</option>
                <option value="PAID">The order is paid</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              {reviewRequestTrigger === 'PAID' ? 'Wait this many days after the order is paid' : 'Wait this many days after fulfillment'}
              <select className="min-h-10 w-full rounded-lg border border-[#c9cccf] bg-white px-2 font-normal" value={requestDelayDays} onChange={(event) => setRequestDelayDays(event.currentTarget.value)}>
                {REVIEW_DELAY_DAYS.map((days) => <option key={days} value={days}>{days} days</option>)}
              </select>
            </label>
          </div>
          <p className="mt-3 text-sm text-[#6d7175]">{automaticRequests ? 'These choices are used for the next automatic email.' : 'These choices are saved now and used when automatic emails are turned on.'}</p>
        </section>
        <section className="rounded-xl border border-[#e3e3e3] bg-white p-4 sm:p-5 lg:col-span-2">
          <h2 className="text-base font-semibold">Appearance</h2>
          <label className="mt-4 grid max-w-md gap-1 text-sm font-semibold">
            Primary color
            <span className="flex min-w-0 items-center gap-3 font-normal">
              <input type="color" value={/^#[0-9a-f]{6}$/i.test(primaryColor) ? primaryColor : '#2563eb'} onChange={(event) => setPrimaryColor(event.currentTarget.value)} className="h-10 w-14 cursor-pointer rounded-lg border border-[#c9cccf] bg-white p-1" aria-label="Primary color picker" />
              <input className="min-h-10 min-w-0 flex-1 rounded-lg border border-[#c9cccf] px-3" value={primaryColor} onChange={(event) => setPrimaryColor(event.currentTarget.value)} autoComplete="off" aria-label="Primary color" />
            </span>
          </label>
          <p className="mt-2 text-sm text-[#6d7175]">Six-digit hex color, for example #2563eb.</p>
        </section>
      </div>
      <div className="flex justify-end">
        <button type="submit" className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#008060] px-4 text-sm font-semibold text-white hover:bg-[#006e52] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#008060] disabled:opacity-60" disabled={saving}>
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </div>
    </Form>
  );
}

function positionLabel(position: ReviewButtonPosition) {
  return REVIEW_BUTTON_POSITIONS.find(([value]) => value === position)?.[1] ?? 'Middle right';
}

void ReviewsButtonEditor;

function ReviewsButtonEditor({
  position,
  setPosition,
  horizontalOffset,
  setHorizontalOffset,
  verticalOffset,
  setVerticalOffset,
  orientation,
  setOrientation,
}: {
  position: ReviewButtonPosition;
  setPosition: (value: ReviewButtonPosition) => void;
  horizontalOffset: number;
  setHorizontalOffset: (value: number) => void;
  verticalOffset: number;
  setVerticalOffset: (value: number) => void;
  orientation: ReviewButtonOrientation;
  setOrientation: (value: ReviewButtonOrientation) => void;
}) {
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const buttonStyle = reviewButtonPreviewStyle(position, horizontalOffset, verticalOffset, orientation);
  const positionStyle = {...buttonStyle, writingMode: 'horizontal-tb' as const};
  const changeOffset = (axis: 'horizontal' | 'vertical', delta: number) => {
    const current = axis === 'horizontal' ? horizontalOffset : verticalOffset;
    const next = Math.min(500, Math.max(0, current + delta));
    (axis === 'horizontal' ? setHorizontalOffset : setVerticalOffset)(next);
  };
  return (
    <div className="mt-5 grid min-w-0 gap-5 xl:grid-cols-2">
      <div className="grid gap-4">
        <div>
          <h3 className="text-sm font-semibold">Reviews Button Position</h3>
          <p className="mt-1 text-sm text-[#6d7175]">Choose a position, then fine tune it with offsets.</p>
        </div>
        <div className="relative grid aspect-[16/9] min-h-64 grid-cols-3 grid-rows-3 overflow-hidden rounded-xl border border-[#c9cccf] bg-[#f6f6f7] p-4 shadow-inner" aria-label="Reviews button position selector">
          {REVIEW_BUTTON_POSITIONS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-label={label}
              aria-pressed={position === value}
              title={label}
              onClick={() => setPosition(value)}
              className={`group relative z-10 flex min-h-12 min-w-12 items-center justify-center rounded-lg transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#008060] ${position === value ? 'bg-[#e3f1df]' : 'hover:bg-white'}`}
            >
              <span className={`h-3 w-3 rounded-full border-2 transition ${position === value ? 'border-[#008060] bg-[#008060] ring-4 ring-[#b7e1cd]' : 'border-[#8c9196] bg-white group-hover:border-[#008060]'}`} />
            </button>
          ))}
          <div className="pointer-events-none absolute inset-x-1/4 top-1/3 bottom-1/3 rounded-lg border border-dashed border-[#d2d5d8] bg-white/70" />
          <span className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-md bg-[#202223] px-3 py-2 text-xs font-semibold text-white">Reviews</span>
        </div>
        <p className="text-sm font-semibold text-[#202223]" aria-live="polite">Position: {positionLabel(position)}</p>
        <fieldset className="grid gap-2">
          <legend className="text-sm font-semibold">Fine tune position</legend>
          {([
            ['Horizontal offset', horizontalOffset, setHorizontalOffset],
            ['Vertical offset', verticalOffset, setVerticalOffset],
          ] as const).map(([label, value, setter]) => (
            <label key={label} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 text-sm">
              <span>{label}</span>
              <button type="button" className="h-9 w-9 rounded-lg border border-[#c9cccf] bg-white text-lg hover:bg-[#f6f6f7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#008060]" onClick={() => changeOffset(label.startsWith('Horizontal') ? 'horizontal' : 'vertical', -1)} aria-label={`Decrease ${label}`}>−</button>
              <input type="number" min="0" max="500" value={value} onChange={(event) => setter(Math.min(500, Math.max(0, Number(event.currentTarget.value) || 0)))} className="h-9 w-20 rounded-lg border border-[#c9cccf] px-2 text-center" aria-label={`${label} in pixels`} />
              <button type="button" className="h-9 w-9 rounded-lg border border-[#c9cccf] bg-white text-lg hover:bg-[#f6f6f7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#008060]" onClick={() => changeOffset(label.startsWith('Horizontal') ? 'horizontal' : 'vertical', 1)} aria-label={`Increase ${label}`}>+</button>
            </label>
          ))}
          <p className="text-xs text-[#6d7175]">Offsets are limited to 0–500 px.</p>
        </fieldset>
        <fieldset className="grid gap-2">
          <legend className="text-sm font-semibold">Button orientation</legend>
          <div className="grid grid-cols-2 gap-2">
            {REVIEW_BUTTON_ORIENTATIONS.map((value) => (
              <button key={value} type="button" aria-pressed={orientation === value} onClick={() => setOrientation(value)} className={`rounded-lg border p-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#008060] ${orientation === value ? 'border-[#008060] bg-[#e3f1df]' : 'border-[#c9cccf] bg-white hover:bg-[#f6f6f7]'}`}>
                <span className="block text-lg font-bold">{value === 'vertical' ? '★' : '★ Reviews'}</span>
                <span className="text-sm font-semibold capitalize">{value}</span>
              </button>
            ))}
          </div>
        </fieldset>
      </div>
      <div className="rounded-xl border border-[#e3e3e3] bg-[#f6f6f7] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Live Preview</h3>
            <p className="mt-1 text-xs text-[#6d7175]">Changes appear here instantly. Save when you&apos;re happy with the position.</p>
          </div>
          <div className="inline-flex rounded-lg border border-[#c9cccf] bg-white p-1" role="group" aria-label="Preview size">
            {(['desktop', 'mobile'] as const).map((value) => (
              <button key={value} type="button" aria-pressed={previewMode === value} onClick={() => setPreviewMode(value)} className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize ${previewMode === value ? 'bg-[#202223] text-white' : 'text-[#6d7175]'}`}>{value}</button>
            ))}
          </div>
        </div>
        <div className={`relative mx-auto mt-4 overflow-hidden border border-[#c9cccf] bg-white transition-all duration-300 ${previewMode === 'mobile' ? 'aspect-[9/16] max-w-[220px] rounded-[24px] border-4' : 'aspect-[16/10] w-full rounded-lg'}`}>
          <div className="border-b border-[#e3e3e3] px-4 py-2 text-xs font-semibold">Store <span className="ml-4 font-normal text-[#6d7175]">Home&nbsp;&nbsp;&nbsp;Catalog&nbsp;&nbsp;&nbsp;Contact</span></div>
          <div className={`grid gap-4 p-5 ${previewMode === 'mobile' ? 'grid-cols-1' : 'grid-cols-2'}`}>
            <div className="aspect-square rounded-lg bg-[#e3e3e3] text-center text-xs text-[#6d7175]"><span className="relative top-1/2">Product image</span></div>
            <div>
              <p className="text-sm font-semibold">Product Name</p>
              <p className="mt-1 text-xs text-[#f5b301]">★★★★★ <span className="text-[#6d7175]">4.8</span></p>
              <p className="mt-2 text-xs text-[#6d7175]">$49.00</p>
              <p className="mt-3 text-xs text-[#6d7175]">Product description</p>
            </div>
          </div>
          <span className="pointer-events-none absolute z-10 block h-max w-max max-w-max bg-transparent p-0" style={{...positionStyle, writingMode: 'horizontal-tb'}} aria-hidden="true">
            <span className={`inline-flex h-max w-max max-w-max items-center gap-1 rounded-[12px] bg-[#111] px-2.5 py-3 text-xs font-bold tracking-wide text-white ${orientation === 'horizontal' ? 'flex-row' : 'flex-col'}`} style={{writingMode: orientation === 'vertical' ? 'vertical-rl' : 'horizontal-tb'}}>★ <span>Reviews</span></span>
          </span>
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 text-[10px] font-semibold text-[#008060]"><span aria-hidden="true">●</span> Live</span>
        </div>
      </div>
    </div>
  );
}
