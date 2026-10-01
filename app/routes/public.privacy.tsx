import {PublicSite, SupportContact, publicMeta} from '../components/public/site';

export function meta() {
  return publicMeta({
    title: 'Privacy Policy | Product Reviews',
    description: 'Privacy Policy for the Product Reviews Shopify app, including the data the app stores, how it is used, and how Shopify privacy requests are handled.',
    path: '/privacy',
  });
}

export default function PrivacyPolicy() {
  return (
    <PublicSite>
      <article className="pr-card">
        <h1>Privacy Policy</h1>
        <p className="pr-when">Effective date: 2 October 2026</p>
        <p>This policy describes the personal data that the Product Reviews Shopify app processes. It is limited to behavior implemented in the application.</p>

        <h2>Who operates the app</h2>
        <p>Product Reviews is published by the Shopify Partner account Artifyanni. The production address of the app is https://productreviews.it3.in.</p>

        <h2>Information collected</h2>
        <h3>Shopify merchant and store information</h3>
        <ul>
          <li>Shop domain, and the Shopify shop id when Shopify returns it.</li>
          <li>Shop name, when it is available.</li>
          <li>App settings chosen by the merchant, including review-request timing, storefront display options, and the primary color.</li>
          <li>A Shopify session for the installed shop, including the access token used to call Shopify. An online staff session can include that staff member’s name and email when Shopify provides them.</li>
          <li>Plan and usage counts for reviews, review requests, and media bytes.</li>
        </ul>
        <h3>Customer information</h3>
        <p>The app requests the Shopify access scopes <code>read_products</code>, <code>read_orders</code>, and <code>read_customers</code>. When Shopify provides them, the app can store:</p>
        <ul>
          <li>Shopify customer id.</li>
          <li>Customer display name.</li>
          <li>Customer email address. The stored email is encrypted with AES-256-GCM.</li>
          <li>Order id, order number, fulfillment date, and payment status, used to decide when a review email can be sent.</li>
        </ul>
        <p>If Shopify does not provide the customer email, the app does not invent or substitute an email address for that customer. The review request is not sent to the customer.</p>
        <h3>Product review information</h3>
        <ul>
          <li>Star rating, optional title, review text, display name, status, verified-purchase flag, and submission time.</li>
          <li>A review submitted from a review-request email is stored as approved. A review submitted from the storefront form is stored as pending until a merchant approves it.</li>
          <li>If file storage is configured, a review can include photo or video metadata and the uploaded file. File storage is optional and is not part of the base database record.</li>
        </ul>
        <h3>Other records</h3>
        <ul>
          <li>Review-request tokens are stored encrypted. A hash of the token is stored so the link can be looked up.</li>
          <li>Email delivery records store a masked recipient, a hash of the recipient, and the delivery status. They do not store the SMTP password.</li>
          <li>An unsubscribe action stores a consent record for the purpose <code>review_request</code> with consent not granted.</li>
          <li>The app stores the JSON body of Shopify webhooks it receives. That body can contain the customer and order fields Shopify included.</li>
          <li>A Shopify <code>customers/data_request</code> webhook stores a copy of the customer’s stored name, orders, reviews, and consent records on the privacy-request row.</li>
        </ul>

        <h2>How information is used</h2>
        <ul>
          <li>To show approved reviews and ratings on the merchant’s store.</li>
          <li>To let the merchant moderate reviews and add a review from the Shopify admin.</li>
          <li>To send one review-request email per order when the merchant turns automatic emails on. The email is sent after fulfillment or after payment, using the delay the merchant selected (2 to 10 days).</li>
          <li>To open a review page from that email. The name on that page comes from the order and is not an editable field.</li>
          <li>To stop further review-request emails after the customer uses the unsubscribe link.</li>
          <li>To mark a review as a verified purchase when the stored order has a fulfilled quantity for that product, or when the merchant sets the verified-buyer control.</li>
          <li>To process Shopify uninstall and privacy webhooks.</li>
        </ul>
        <p>The app does not sell personal information and does not include an advertising or analytics integration.</p>

        <h2>Data storage</h2>
        <p>Shop, customer, order, review, consent, webhook, and privacy-request records are stored in the application database. Customer email addresses and review-link tokens are encrypted in that database with AES-256-GCM. Review text, display names, order numbers, and stored webhook JSON are not separately encrypted by the application.</p>
        <p>The public site is served over HTTPS at https://productreviews.it3.in.</p>

        <h2>Data retention</h2>
        <p>The app does not run an automatic job that deletes personal data after a fixed number of days.</p>
        <ul>
          <li>A review-request link stops working after the shop’s request expiration period. The default period is 30 days. The request is marked expired. The database row is not deleted by that step.</li>
          <li>Uninstalling the app cancels review requests that have not been sent. It does not by itself delete the shop’s stored reviews or customer records.</li>
          <li>When Shopify sends <code>shop/redact</code>, the app deletes that shop’s stored record. Related shop data that is set to cascade with the shop is deleted with it.</li>
          <li>When Shopify sends <code>customers/redact</code>, the app deletes that customer’s record, consent records, and review requests. It clears the customer and order link on that customer’s reviews and replaces the review display name with “Customer”. The review text remains.</li>
        </ul>

        <h2>Data security</h2>
        <ul>
          <li>Merchant admin pages require a Shopify authenticated session.</li>
          <li>Shopify webhooks are checked with the Shopify HMAC signature before they are processed.</li>
          <li>Customer email addresses and review-link tokens use AES-256-GCM.</li>
          <li>The SMTP password, when one is saved, is stored encrypted. Plain SMTP is rejected unless insecure SMTP is explicitly enabled.</li>
        </ul>
        <p>This policy does not claim SOC 2, ISO 27001, or a GDPR certification. Not every personal-data field is encrypted by the application.</p>

        <h2>Third-party services</h2>
        <ul>
          <li>Shopify provides installation, the embedded admin, store data, webhooks, and the storefront app proxy.</li>
          <li>Review-request email is sent through the SMTP server configured for the app. The message leaves the app only when that server accepts it.</li>
          <li>Uploaded review files are sent to file storage only when file storage is configured.</li>
        </ul>

        <h2>Data sharing</h2>
        <p>Approved review content, including the display name, rating, and review text, is shown on the merchant’s storefront. Customer email addresses are sent to the configured SMTP server when a review-request email is sent. The app does not sell personal data.</p>
        <p>A merchant can start a test review email and type the recipient. That address is used for the test send. It is not saved as the customer’s email address.</p>

        <h2>Merchant controls</h2>
        <p>A merchant can turn automatic emails off, choose fulfillment or payment as the trigger, choose a delay from 2 to 10 days, hide the storefront write-review button, and hide the store-wide Reviews tab. A merchant can approve, disapprove, hide, feature, or delete a review, and can uninstall the app from Shopify.</p>

        <h2>Customer choices</h2>
        <p>A review-request email includes an unsubscribe link. Using it records that the customer does not consent to further review-request email for that store and cancels scheduled requests for that customer. The app does not provide a separate customer account page.</p>

        <h2>Shopify privacy requests</h2>
        <p>The app accepts Shopify compliance webhooks for <code>customers/data_request</code>, <code>customers/redact</code>, and <code>shop/redact</code>. Requests must include a valid Shopify HMAC signature. The handling is described under Data retention. A data-request webhook records the request and stores the export on that privacy-request row. It does not email the export to the customer.</p>

        <h2>Contact</h2>
        <SupportContact />
        <p>Customers and merchants can also submit privacy requests through Shopify, which delivers the compliance webhooks above.</p>

        <h2>Policy updates</h2>
        <p>If this policy changes, the updated text and effective date will be published on this page.</p>
      </article>
    </PublicSite>
  );
}
