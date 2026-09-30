import {Form, Outlet, useLoaderData} from 'react-router';
import '../styles/platform-admin.css';
import {assertCsrf, destroyPlatformSession, requirePlatformAdmin, writePlatformAudit} from '../modules/admin/session.server';

export async function loader({request}: {request: Request}) {
  const session = await requirePlatformAdmin(request);
  return {email: session.admin.email, csrfToken: session.csrfToken};
}

export async function action({request}: {request: Request}) {
  const session = await requirePlatformAdmin(request);
  const form = await request.formData();
  assertCsrf(session.csrfToken, form.get('csrfToken'));
  if (form.get('intent') === 'logout') {
    await writePlatformAudit({adminId: session.adminId, action: 'ADMIN_LOGOUT'});
    const cookie = await destroyPlatformSession(request);
    return new Response(null, {status: 302, headers: {Location: '/admin/login', 'Set-Cookie': cookie}});
  }
  return null;
}

export default function PlatformAdminLayout() {
  const {email, csrfToken} = useLoaderData<typeof loader>();
  return (
    <main className="platform-shell">
      <header>
        <strong>Shopify Review operations</strong>
        <Form method="post" action="/admin">
          <input type="hidden" name="csrfToken" value={csrfToken} />
          <input type="hidden" name="intent" value="logout" />
          <button type="submit">Log out {email}</button>
        </Form>
      </header>
      <nav className="platform-nav">
        <a href="/admin">Dashboard</a>
        <a href="/admin/smtp">SMTP</a>
        <a href="/admin/email-templates">Email templates</a>
        <a href="/admin/email-logs">Email logs</a>
        <a href="/admin/system">System</a>
        <a href="/admin/audit-log">Audit log</a>
      </nav>
      <Outlet context={{csrfToken}} />
    </main>
  );
}
