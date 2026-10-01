import {PublicSite, SupportContact, publicMeta} from '../components/public/site';

export function meta() {
  return publicMeta({
    title: 'Tutorial | Product Reviews',
    description: 'Install Product Reviews, choose settings, add the theme blocks, and moderate reviews.',
    path: '/tutorial',
  });
}

export default function Tutorial() {
  return (
    <PublicSite>
      <article className="pr-card">
        <h1>Tutorial</h1>
        <p className="pr-lead">These steps follow the pages and controls in the Product Reviews app. The project does not include public screenshots.</p>
        <h2>1. Install the app</h2>
        <ol>
          <li>Install Product Reviews on the Shopify store.</li>
          <li>Approve access to products, orders, and customers.</li>
          <li>Open Product Reviews from the Shopify admin. The app opens inside the admin.</li>
        </ol>
        <h2>2. Open the app</h2>
        <p>The admin navigation contains Dashboard, Reviews, Review Requests, Settings, and Plan &amp; usage. Dashboard shows review totals, average rating, approved reviews, verified purchases, rating distribution, review status, and review-request counts when that data exists.</p>
        <h2>3. Initial configuration</h2>
        <p>Open Settings and choose Save settings after any change.</p>
        <ul>
          <li>Show “Write a review” button. Off until you turn it on. Customers can still review from a review-request email while it is off.</li>
          <li>Reviews button. On in the app by default, and still hidden until the Product Reviews app embed is enabled in the theme editor.</li>
          <li>Automatic review-request emails. Off until you turn them on.</li>
          <li>When automatic emails are on, choose “The order is fulfilled” or “The order is paid”, then a wait of 2 to 10 days.</li>
          <li>Primary color: a six-digit hex color.</li>
        </ul>
        <p>If automatic emails are on and SMTP is not configured, Settings shows: “SMTP is not configured. Configure SMTP before sending review-request emails.”</p>
        <h2>4. Collect and manage reviews</h2>
        <ol>
          <li>Open Reviews.</li>
          <li>Use Add review to create a review for a product. Choose the status and whether it is a verified purchase. A verified purchase is not applied unless you turn that control on or the order has fulfillment for that product.</li>
          <li>Use Approve to show a review on the storefront. Use Disapprove, Hide, or Delete to keep it off the storefront. Use Feature to feature it.</li>
          <li>Open Review Requests to see one row set per order, including status, schedule, and whether a test email was used.</li>
        </ol>
        <p>A storefront submission stays pending until it is approved. A submission from the review-request email is approved when the customer submits it. The name on that email review page is the order customer’s name and cannot be edited.</p>
        <h2>5. Show reviews on the storefront</h2>
        <p>In the theme editor, add the theme app blocks:</p>
        <ul>
          <li>Product rating, for a rating on a product section.</li>
          <li>Product reviews, for the review list on a product section. The block can show a rating breakdown, sort, customer name, date, and verified badge.</li>
          <li>Product Reviews, an app embed for the floating Reviews button. Enable it under App embeds, then save the theme.</li>
          <li>Product ratings, an app embed for ratings across pages.</li>
        </ul>
        <p>The product review list loads the first reviews and then offers Load more. The floating Reviews button appears only when the Product Reviews app embed is enabled and the Reviews button setting in the app is on. Position and orientation are saved in Settings. The public all-reviews address on the shop is <code>/apps/shopify-review/reviews</code>.</p>
        <h2>6. Troubleshooting</h2>
        <ul>
          <li>A review is missing on the product page: confirm its status is Approved.</li>
          <li>The write-review button is missing: turn on Show “Write a review” button, and in the Product reviews theme block leave “Show review form” enabled.</li>
          <li>No review email was sent: turn on Automatic review-request emails, save a delay from 2 to 10 days, and configure SMTP. The app sends one email per order, not one email per product.</li>
          <li>The email cannot be sent because the customer email is unavailable: the app waits for Shopify to provide that email. It does not replace it with another address.</li>
          <li>A review link says it is not available: the link can be expired, already used, or invalid. The default expiration is 30 days.</li>
          <li>The customer does not want more emails: they use the unsubscribe link in the email. Scheduled requests for that customer are cancelled.</li>
        </ul>
        <h2>7. Contact support</h2>
        <SupportContact />
      </article>
    </PublicSite>
  );
}
