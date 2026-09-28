import {Form, redirect, useActionData} from 'react-router';
import {db} from '../db.server';
import {requestClientKey} from '../lib/rate-limit.server';
import {attemptPlatformLogin} from '../modules/admin/auth';
import {createPlatformSession, platformSessionCookie, readPlatformSession, writePlatformAudit} from '../modules/admin/session.server';

export async function loader({request}: {request: Request}) {
  if (await readPlatformSession(request)) return redirect('/admin');
  return null;
}

export async function action({request}: {request: Request}) {
  const form = await request.formData();
  const email = String(form.get('email') ?? '');
  const password = String(form.get('password') ?? '');
  const result = await attemptPlatformLogin({
    email,
    password,
    rateKey: requestClientKey(request),
    findAdmin: (normalized) => db.platformAdmin.findUnique({where: {email: normalized}, select: {id: true, passwordHash: true}}),
  });
  if (!result.ok) {
    await writePlatformAudit({action: 'ADMIN_LOGIN_FAILED', metadata: {reason: result.reason}});
    return {error: result.reason === 'RATE_LIMITED' ? 'Too many login attempts. Try again later.' : 'The email or password is incorrect.'};
  }
  const created = await createPlatformSession(result.adminId);
  await writePlatformAudit({adminId: result.adminId, action: 'ADMIN_LOGIN'});
  return redirect('/admin', {headers: {'Set-Cookie': await platformSessionCookie.serialize(created.token)}});
}

export default function PlatformLogin() {
  const result = useActionData<typeof action>();
  return (
    <main style={{maxWidth: 420, margin: '4rem auto', fontFamily: 'sans-serif'}}>
      <h1>Platform administration</h1>
      <p>This login is separate from the Shopify merchant app.</p>
      {result && 'error' in result ? <p role="alert">{result.error}</p> : null}
      <Form method="post">
        <label>Email<br /><input name="email" type="email" autoComplete="username" required /></label>
        <label>Password<br /><input name="password" type="password" autoComplete="current-password" required /></label>
        <button type="submit">Log in</button>
      </Form>
    </main>
  );
}
