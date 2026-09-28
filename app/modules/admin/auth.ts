import {consumeRateLimit} from '../../lib/rate-limit.server';
import {verifyPassword} from '../../lib/password.server';

export async function attemptPlatformLogin(input: {
  email: string;
  password: string;
  rateKey: string;
  findAdmin: (email: string) => Promise<{id: string; passwordHash: string} | null>;
}) {
  const rate = consumeRateLimit(`platform-login:${input.rateKey}`, 5, 15 * 60_000);
  if (!rate.allowed) return {ok: false as const, reason: 'RATE_LIMITED' as const};
  const admin = await input.findAdmin(input.email.toLowerCase());
  if (!admin || !verifyPassword(input.password, admin.passwordHash)) {
    return {ok: false as const, reason: 'INVALID' as const};
  }
  return {ok: true as const, adminId: admin.id};
}
