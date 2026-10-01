import {PublicSite, publicMeta} from '../components/public/site';

export function meta() {
  return publicMeta({
    title: 'Changelog | Product Reviews',
    description: 'Confirmed Product Reviews updates. Release notes are listed only when the repository or a released app version records them.',
    path: '/changelog',
  });
}

export default function Changelog() {
  return (
    <PublicSite>
      <article className="pr-card">
        <h1>Product updates</h1>
        <p className="pr-lead">Repository commit messages do not describe features, so this page does not turn those commits into a release history. The entries below are limited to a released app version and to functionality that is present in the application.</p>
        <div className="pr-timeline">
          <section className="pr-card">
            <p className="pr-when">Date: 1 October 2026</p>
            <h2>Version product-reviews-17</h2>
            <h3>Changes</h3>
            <ul>
              <li>The released app address, OAuth callback, and app proxy URL use https://productreviews.it3.in.</li>
            </ul>
            <h3>Improvements</h3>
            <p>No other improvement is recorded for this version.</p>
            <h3>Bug fixes</h3>
            <p>No bug fix is recorded for this version.</p>
          </section>
          <section className="pr-card">
            <p className="pr-when">Date: current application</p>
            <h2>Version: current application</h2>
            <h3>Changes</h3>
            <ul>
              <li>Merchant pages: Dashboard, Reviews, Review Requests, Settings, and Plan &amp; usage.</li>
              <li>Review moderation with Approve, Disapprove, Hide, Feature, Delete, and a verified-buyer control.</li>
              <li>Theme blocks: Product rating, Product reviews, Product ratings, and Customer reviews embed.</li>
              <li>One review-request email per order, sent only after the merchant turns automatic emails on.</li>
            </ul>
            <h3>Improvements</h3>
            <p>Not listed separately, because the repository does not record which of these shipped as an improvement versus the first implementation.</p>
            <h3>Bug fixes</h3>
            <p>No confirmed bug-fix list is available from the repository history.</p>
          </section>
        </div>
      </article>
    </PublicSite>
  );
}
