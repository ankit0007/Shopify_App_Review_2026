import {authenticate} from '../shopify.server';

export async function loader({request}: {request: Request}) {
  return authenticate.admin(request);
}
