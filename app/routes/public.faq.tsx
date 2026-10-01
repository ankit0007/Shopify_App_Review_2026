import {PublicSite, SupportContact, publicMeta} from '../components/public/site';

export function meta() {
  return publicMeta({
    title: 'FAQ | Product Reviews',
    description: 'Answers about installing Product Reviews, showing reviews, moderation, customer data, uninstall, and data deletion.',
    path: '/faq',
  });
}

export default function Faq() {
  return (
    <PublicSite>
      <article className="pr-card">
        <h1>FAQ</h1>
        <h2>What does Product Reviews do?</h2>
        <p>It stores product reviews for a Shopify store, lets the merchant moderate them, shows approved reviews on the storefront, and can email a customer one review request per order.</p>
        <h2>How do I install the app?</h2>
        <p>Install Product Reviews on the Shopify store and approve the requested access to products, orders, and customers. Then open Product Reviews from the Shopify admin Apps list.</p>
        <h2>How do I configure the app?</h2>
        <p>Open Settings. You can show or hide the storefront “Write a review” button, show or hide the Reviews tab, turn automatic review-request emails on or off, choose whether those emails start after fulfillment or after payment, choose a delay from 2 to 10 days, and set a primary color. Save settings when you are done. For a new shop, the write-review button and automatic emails are off, and the Reviews tab is on.</p>
        <h2>How do I display product reviews?</h2>
        <p>In the theme editor, add the Product Reviews theme blocks you need. The blocks are named Product rating, Product reviews, Product ratings, and Customer reviews embed. Approved reviews can also appear in the Reviews tab when that setting is on. The all-reviews page is served through the app proxy path <code>/apps/shopify-review/reviews</code>.</p>
        <h2>How are reviews collected?</h2>
        <ul>
          <li>From the storefront form, when the write-review button is enabled. Those reviews stay pending until a merchant approves them.</li>
          <li>From the link in a review-request email. Those reviews are published as approved.</li>
          <li>From Add review on the Reviews page in the Shopify admin.</li>
        </ul>
        <h2>How are reviews managed?</h2>
        <p>Open Reviews. You can filter the list, move between pages, and use Approve, Disapprove, Hide, Feature, or Delete on a review. A verified-buyer checkbox is on each review. Add review creates a review for a product in the shop.</p>
        <h2>How do merchants moderate reviews?</h2>
        <p>Only approved reviews are shown on the storefront. Disapprove, hide, or delete a review to keep it off the store. A review from the storefront form starts as pending. A review from a review-request email starts as approved.</p>
        <h2>What happens when the app is uninstalled?</h2>
        <p>The app records the uninstall and cancels review requests that have not been sent. Stored reviews and customer records are not deleted at uninstall. They are deleted when Shopify later sends the shop redact webhook.</p>
        <h2>Does the app access customer information?</h2>
        <p>It can store a Shopify customer id, display name, and email when Shopify provides them, plus the order fields needed to schedule a review email. The email is encrypted in the database. If Shopify does not provide the email, the app does not send the review request to a replacement address.</p>
        <h2>How is customer data handled?</h2>
        <p>It is used to show reviews and, when enabled, to send the review-request email. The customer can unsubscribe from further review-request email. See the <a href="/privacy">Privacy Policy</a> for the stored fields, retention, and Shopify privacy webhooks.</p>
        <h2 id="support">How can I contact support?</h2>
        <SupportContact />
        <h2>How can I request data deletion?</h2>
        <p>Shopify sends <code>customers/redact</code> for a customer and <code>shop/redact</code> after a shop uninstall. The app processes those webhooks. Customer redact deletes the customer record, consent records, and review requests, and replaces the review display name with “Customer”. The review text is kept. Shop redact deletes the shop’s stored data.</p>
      </article>
    </PublicSite>
  );
}
