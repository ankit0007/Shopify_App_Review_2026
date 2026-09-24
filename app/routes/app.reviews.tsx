import {Page, EmptyState} from '@shopify/polaris';
import {authenticate} from '../shopify.server';

export async function loader({request}: {request: Request}) {
  await authenticate.admin(request);
  return null;
}

export default function Reviews() {
  return (
    <Page title="Reviews">
      <EmptyState heading="No reviews yet" image="" fullWidth>
        Reviews submitted by customers will appear here for moderation.
      </EmptyState>
    </Page>
  );
}
