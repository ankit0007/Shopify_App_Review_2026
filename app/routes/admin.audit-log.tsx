import {useLoaderData} from 'react-router';
import {db} from '../db.server';
import {requirePlatformAdmin} from '../modules/admin/session.server';

export async function loader({request}: {request: Request}) {
  await requirePlatformAdmin(request);
  const logs = await db.platformAuditLog.findMany({
    orderBy: {createdAt: 'desc'},
    take: 100,
    select: {id: true, action: true, metadata: true, createdAt: true, admin: {select: {email: true}}},
  });
  return {logs};
}

export default function PlatformAuditLog() {
  const {logs} = useLoaderData<typeof loader>();
  return (
    <section>
      <h1>Audit log</h1>
      <table>
        <thead><tr><th>When</th><th>Admin</th><th>Action</th><th>Details</th></tr></thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td>{new Date(log.createdAt).toLocaleString()}</td>
              <td>{log.admin?.email ?? 'Unknown'}</td>
              <td>{log.action}</td>
              <td>{JSON.stringify(log.metadata ?? {})}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
