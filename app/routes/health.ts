import type {LoaderFunctionArgs} from 'react-router';
import {db} from '../db.server';

export async function loader({request}: LoaderFunctionArgs) {
  if (new URL(request.url).pathname !== '/health') {
    return new Response('Not found', {status: 404});
  }

  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({success: true, data: {status: 'ok', database: 'ok'}});
  } catch {
    return Response.json(
      {success: false, error: {code: 'DATABASE_UNAVAILABLE', message: 'Database is unavailable'}},
      {status: 503},
    );
  }
}
