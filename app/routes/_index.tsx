import {redirect} from 'react-router';

export function loader({request}: {request: Request}) {
  const url = new URL(request.url);
  if (url.searchParams.has('shop')) {
    return redirect(`/app${url.search}`);
  }
  return null;
}

export default function Index() {
  return (
    <main style={{fontFamily: 'system-ui, sans-serif', margin: '4rem auto', maxWidth: 640, padding: '0 1.5rem'}}>
      <h1>Shopify Review</h1>
      <p>The app server is running.</p>
      <p>Install the app on a Shopify store, then open it from the Shopify admin.</p>
    </main>
  );
}
