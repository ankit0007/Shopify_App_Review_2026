import {createHash, randomBytes, timingSafeEqual} from 'node:crypto';
import {createCookie, redirect} from 'react-router';
import {config, isProduction} from '../../config.server';
import {db} from '../../db.server';
import {safeAuditMetadata} from './audit';

export const platformSessionCookie = createCookie('platform_admin', {
  httpOnly: true,
  sameSite: 'lax',
  path: '/admin',
  secure: isProduction,
  secrets: [config.SESSION_SECRET],
  maxAge: 60 * 60 * 12,
});

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function createPlatformSession(adminId: string) {
  const token = randomBytes(32).toString('base64url');
  const csrfToken = randomBytes(24).toString('base64url');
  const session = await db.platformSession.create({
    data: {
      adminId,
      tokenHash: hashToken(token),
      csrfToken,
      expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
    },
  });
  return {token, csrfToken, sessionId: session.id};
}

export async function readPlatformSession(request: Request) {
  const token = await platformSessionCookie.parse(request.headers.get('cookie'));
  if (typeof token !== 'string' || !token) return null;
  const session = await db.platformSession.findUnique({
    where: {tokenHash: hashToken(token)},
    include: {admin: true},
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session;
}

export async function requirePlatformAdmin(request: Request) {
  const session = await readPlatformSession(request);
  if (!session) throw redirect('/admin/login');
  return session;
}

export async function destroyPlatformSession(request: Request) {
  const token = await platformSessionCookie.parse(request.headers.get('cookie'));
  if (typeof token === 'string' && token) {
    await db.platformSession.deleteMany({where: {tokenHash: hashToken(token)}});
  }
  return platformSessionCookie.serialize('', {maxAge: 0});
}

export function assertCsrf(sessionToken: string, formToken: FormDataEntryValue | null) {
  const provided = typeof formToken === 'string' ? formToken : '';
  const expected = Buffer.from(sessionToken);
  const actual = Buffer.from(provided);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new Response('Request origin is not allowed.', {status: 403});
  }
}

export async function writePlatformAudit(input: {adminId?: string | null; action: string; metadata?: Record<string, string | number | boolean | null>}) {
  await db.platformAuditLog.create({
    data: {
      adminId: input.adminId || null,
      action: input.action,
      metadata: safeAuditMetadata(input.metadata),
    },
  });
}
