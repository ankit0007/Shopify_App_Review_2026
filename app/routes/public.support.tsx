import {PublicSite, SupportContact, publicMeta, SUPPORT_EMAIL} from '../components/public/site';

export function meta() {
  return publicMeta({
    title: 'Product Reviews Support | Help Center',
    description: 'Get help with Product Reviews, including setup, review management, display settings, troubleshooting, and subscription support.',
    path: '/support',
  });
}

const helpSections = [
  {
    title: 'Getting Started',
    text: 'Install Product Reviews from Shopify, approve the requested access, and open the app from the Shopify admin.',
    href: '/tutorial',
    label: 'Read the tutorial',
  },
  {
    title: 'Managing Reviews',
    text: 'Use the Reviews page to browse reviews, change the page size, add a review, and manage review status.',
    href: '/docs#review-management',
    label: 'Review management',
  },
  {
    title: 'Review Display',
    text: 'Add the Product Reviews theme blocks in Shopify’s theme editor to display ratings, review sections, and the store-wide Reviews tab.',
    href: '/docs#storefront-display',
    label: 'Display documentation',
  },
  {
    title: 'Review Moderation',
    text: 'Approve, disapprove, hide, feature, delete, or mark reviews as verified purchases from the Reviews page.',
    href: '/faq',
    label: 'Moderation FAQ',
  },
  {
    title: 'App Settings',
    text: 'Configure the storefront button, Reviews tab, automatic review requests, trigger, delay, and primary color in Settings.',
    href: '/docs#setup',
    label: 'Settings documentation',
  },
  {
    title: 'Billing & Subscription',
    text: 'Plan and usage information is available inside the authenticated Shopify app. Subscription changes are managed through Shopify.',
    href: '/docs#billing',
    label: 'Billing information',
  },
  {
    title: 'Troubleshooting',
    text: 'Find practical checks for missing reviews, storefront buttons, review emails, customer email availability, and expired links.',
    href: '/docs#troubleshooting',
    label: 'Troubleshooting guide',
  },
];

export default function Support() {
  return (
    <PublicSite>
      <article className="pr-card">
        <p className="pr-when">Help Center</p>
        <h1>Product Reviews Support</h1>
        <p className="pr-lead">Need help with Product Reviews? Find answers, documentation, and contact support.</p>

        <h2>How can we help?</h2>
        <div className="pr-support-grid">
          {helpSections.map((section) => (
            <section className="pr-support-card" key={section.title}>
              <h3>{section.title}</h3>
              <p>{section.text}</p>
              <a href={section.href}>{section.label}</a>
            </section>
          ))}
        </div>

        <h2>Frequently asked questions</h2>
        <section className="pr-support-faq">
          <h3>How do I install the app?</h3>
          <p>Install Product Reviews on your Shopify store, approve the requested access, and open it from the Shopify admin. See the <a href="/tutorial">tutorial</a>.</p>

          <h3>How do I display reviews on my product pages?</h3>
          <p>Open the Shopify theme editor and add the Product rating or Product reviews theme block. The <a href="/docs#storefront-display">storefront documentation</a> describes the available blocks.</p>

          <h3>How do I manage or moderate reviews?</h3>
          <p>Open Reviews inside the app. You can approve, disapprove, hide, feature, delete, or add reviews, and manage the verified-buyer control. See the <a href="/docs#review-management">review management guide</a>.</p>

          <h3>How do I configure review settings?</h3>
          <p>Open Settings in the authenticated app. There you can configure the storefront button, Reviews tab, automatic review requests, trigger, delay, and primary color.</p>

          <h3>How do I contact support?</h3>
          <p>Send an email to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. The app does not currently provide a public support form, so no support message is stored by this page.</p>

          <h3>How can I cancel my subscription?</h3>
          <p>Subscription and plan changes are handled through Shopify. Open Product Reviews from Shopify admin and use the available plan and usage area, or manage the app subscription from Shopify.</p>
        </section>

        <section className="pr-support-contact" aria-labelledby="contact-support">
          <h2 id="contact-support">Contact Support</h2>
          <SupportContact />
          <div className="pr-actions">
            <a href={`mailto:${SUPPORT_EMAIL}`}>Contact Support</a>
            <a className="pr-secondary" href="/docs">Documentation</a>
            <a className="pr-secondary" href="/faq">FAQ</a>
            <a className="pr-secondary" href="/tutorial">Tutorial</a>
          </div>
        </section>
      </article>
    </PublicSite>
  );
}
