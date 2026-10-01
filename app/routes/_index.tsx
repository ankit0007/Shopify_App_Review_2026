import {redirect} from 'react-router';
import {PublicSite, SupportContact, publicMeta} from '../components/public/site';

export function loader({request}: {request: Request}) {
  const url = new URL(request.url);
  if (url.searchParams.has('shop')) {
    return redirect(`/app${url.search}`);
  }
  return null;
}

export function meta() {
  return publicMeta({
    title: 'Product Reviews',
    description: 'Product Reviews lets a Shopify merchant collect, moderate, and display product reviews, and send one review-request email per order.',
    path: '/',
  });
}

export default function Index() {
  return (
    <PublicSite>
      <article className="pr-card">
        <h1>Product Reviews</h1>
        <p className="pr-lead">Product Reviews is a Shopify app for collecting and showing product reviews on a merchant’s store.</p>
        <p>After the app is installed, a merchant opens it from the Shopify admin. The admin pages are Dashboard, Reviews, Review Requests, Settings, and Plan &amp; usage.</p>
        <h2>What the app does</h2>
        <ul>
          <li>Stores product reviews and shows approved reviews on the storefront.</li>
          <li>Lets a merchant approve, disapprove, hide, feature, delete, or add a review.</li>
          <li>Can send one review-request email for an order after fulfillment or after payment. Automatic emails are off until the merchant turns them on.</li>
          <li>Adds theme blocks for a product rating, a product review section, and a store-wide Reviews tab.</li>
        </ul>
        <div className="pr-actions">
          <a href="/tutorial">Read the tutorial</a>
          <a className="pr-secondary" href="/docs">Documentation</a>
          <a className="pr-secondary" href="/faq">FAQ</a>
          <a className="pr-secondary" href="/privacy">Privacy Policy</a>
          <a className="pr-secondary" href="/changelog">Changelog</a>
        </div>
        <h2>Support</h2>
        <SupportContact />
      </article>
    </PublicSite>
  );
}
