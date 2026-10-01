import {PublicSite, SupportContact, publicMeta} from '../components/public/site';

export function meta() {
  return publicMeta({
    title: 'Documentation | Product Reviews',
    description: 'Merchant documentation for Product Reviews: installation, settings, review management, storefront blocks, privacy, and uninstall.',
    path: '/docs',
  });
}

export default function Docs() {
  return (
    <PublicSite>
      <article className="pr-card">
        <h1>Documentation</h1>
        <h2>Overview</h2>
        <p>Product Reviews collects product reviews, lets a merchant moderate them, displays approved reviews on the Shopify storefront, and can email one review request for each order.</p>
        <h2>Installation</h2>
        <p>Install the app on a Shopify store and approve <code>read_products</code>, <code>read_orders</code>, and <code>read_customers</code>. Open it from the Shopify admin. The first open creates the shop record used by the app.</p>
        <h2 id="setup">Setup</h2>
        <p>Use Settings for the storefront button, the Reviews tab, automatic emails, the email trigger, the delay, and the primary color. Automatic emails and the write-review button stay off until you enable them. The Reviews tab is on unless you turn it off.</p>
        <p>Review emails require SMTP to be configured for the app. Until it is, Settings states that SMTP is not configured.</p>
        <h2>Configuration</h2>
        <ul>
          <li>Send the review email when the order is fulfilled, or when the order is paid.</li>
          <li>Wait 2 to 10 days after that event. A new shop starts at 2 days.</li>
          <li>One email includes the eligible products for that order. Each product has its own review link on the same page.</li>
          <li>The request link expires after the shop’s request expiration period. The default is 30 days. The request is then marked expired.</li>
        </ul>
        <h2 id="review-management">Review management</h2>
        <p>Reviews lists the shop’s reviews with paging sizes of 10, 20, or 50. Actions are Approve, Disapprove, Hide, Feature, and Delete. Verified buyer can be set on a review. Add review creates a review for a product the merchant selects.</p>
        <p>Review Requests lists scheduled, sent, failed, blocked, and completed requests. A merchant can enter an order number and a test recipient to send a test of the review email. That test address is not stored as the customer’s email.</p>
        <p>Dashboard summarizes ratings, review status, and request counts from the shop’s own records. Plan &amp; usage shows the current plan and usage for reviews, review requests, and media bytes.</p>
        <h2 id="storefront-display">Storefront display</h2>
        <p>Add these theme app blocks in the theme editor:</p>
        <ul>
          <li>Product rating</li>
          <li>Product reviews</li>
          <li>Product ratings</li>
          <li>Customer reviews embed</li>
        </ul>
        <p>The Product reviews block includes settings for the heading, star colors, how many reviews to show, sort order, rating breakdown, customer name, date, and verified badge. Its “Show review form” setting must stay enabled if the write-review button should appear, and the app setting for that button must also be on.</p>
        <p>The storefront loads a short first page of reviews and then Load more. The Reviews tab, when enabled, lists reviews for the whole shop. The shop’s all-reviews page is <code>/apps/shopify-review/reviews</code>.</p>
        <h2 id="troubleshooting">Troubleshooting</h2>
        <ul>
          <li>Pending, disapproved, hidden, and deleted reviews are not part of the public approved list.</li>
          <li>The write-review button stays hidden when its Settings control is off.</li>
          <li>Automatic emails do nothing until the Settings control is on and SMTP is configured.</li>
          <li>A missing customer email from Shopify blocks that customer send. The app records that protected customer data is required and does not send the email to another address.</li>
        </ul>
        <h2 id="billing">Billing &amp; subscription</h2>
        <p>Plan and usage information is available inside the authenticated Shopify app. Subscription and plan changes are handled through Shopify.</p>
        <h2>Data and privacy</h2>
        <p>The <a href="/privacy">Privacy Policy</a> lists the stored data, the SMTP and Shopify services involved, and what the uninstall and redact webhooks do. The <a href="/faq">FAQ</a> answers the same topics in shorter form.</p>
        <h2>Uninstallation</h2>
        <p>Uninstall Product Reviews from the Shopify admin. Unsent review requests are cancelled. Stored shop data remains until Shopify sends the shop redact webhook, which deletes that shop’s data from the app.</p>
        <h2>Support</h2>
        <SupportContact />
      </article>
    </PublicSite>
  );
}
