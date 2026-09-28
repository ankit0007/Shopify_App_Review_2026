import {useLoaderData} from 'react-router';
import {config} from '../config.server';
import {db} from '../db.server';
import {requirePlatformAdmin} from '../modules/admin/session.server';

export async function loader({request}: {request: Request}) {
  await requirePlatformAdmin(request);
  let database = 'unavailable';
  try {
    await db.$queryRaw`SELECT 1`;
    database = 'ok';
  } catch {
    database = 'error';
  }
  return {
    database,
    smtpEncryptionConfigured: Boolean(config.EMAIL_CONFIG_ENCRYPTION_KEY),
    storageConfigured: Boolean(config.STORAGE_ENDPOINT && config.STORAGE_BUCKET && config.STORAGE_ACCESS_KEY && config.STORAGE_SECRET_KEY),
  };
}

export default function PlatformSystem() {
  const data = useLoaderData<typeof loader>();
  return (
    <section>
      <h1>System</h1>
      <ul>
        <li>Database: {data.database}</li>
        <li>SMTP encryption key: {data.smtpEncryptionConfigured ? 'configured' : 'missing'}</li>
        <li>Object storage: {data.storageConfigured ? 'configured' : 'not configured'}</li>
      </ul>
    </section>
  );
}
