import {describe, expect, it} from 'vitest';
import {hashPassword} from '../../lib/password.server';
import {attemptPlatformLogin} from './auth';

describe('platform admin login', () => {
  it('accepts the correct password and rejects the wrong one', async () => {
    const passwordHash = hashPassword('correct-horse');
    const findAdmin = async () => ({id: 'admin-1', passwordHash});
    await expect(attemptPlatformLogin({
      email: 'ops@example.com',
      password: 'correct-horse',
      rateKey: 'success-case',
      findAdmin,
    })).resolves.toEqual({ok: true, adminId: 'admin-1'});
    await expect(attemptPlatformLogin({
      email: 'ops@example.com',
      password: 'wrong-password',
      rateKey: 'failure-case',
      findAdmin,
    })).resolves.toEqual({ok: false, reason: 'INVALID'});
  });

  it('rate limits repeated login attempts', async () => {
    const findAdmin = async () => null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await attemptPlatformLogin({email: 'ops@example.com', password: 'nope', rateKey: 'locked-ip', findAdmin});
    }
    await expect(attemptPlatformLogin({
      email: 'ops@example.com',
      password: 'nope',
      rateKey: 'locked-ip',
      findAdmin,
    })).resolves.toEqual({ok: false, reason: 'RATE_LIMITED'});
  });
});
