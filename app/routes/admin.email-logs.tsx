import {useLoaderData} from 'react-router';
import {db} from '../db.server';
import {requirePlatformAdmin} from '../modules/admin/session.server';

export async function loader({request}: {request: Request}) {
  await requirePlatformAdmin(request);
  const logs = await db.emailDelivery.findMany({
    orderBy: {createdAt: 'desc'},
    take: 100,
    select: {
      id: true,
      templateType: true,
      recipientMasked: true,
      status: true,
      retryCount: true,
      failureReason: true,
      createdAt: true,
      acceptedAt: true,
      shop: {select: {shopDomain: true}},
    },
  });
  return {logs};
}

export default function EmailLogs() {
  const {logs} = useLoaderData<typeof loader>();
  return (
    <section>
      <h1>Email logs</h1>
      <table>
        <thead><tr><th>When</th><th>Shop</th><th>Template</th><th>Recipient</th><th>Status</th><th>Retries</th><th>Failure</th></tr></thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td>{new Date(log.createdAt).toLocaleString()}</td>
              <td>{log.shop?.shopDomain ?? 'Platform'}</td>
              <td>{log.templateType}</td>
              <td>{log.recipientMasked}</td>
              <td>{log.status}</td>
              <td>{log.retryCount}</td>
              <td>{log.failureReason ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
