import {db} from '../app/db.server';
import {hashPassword} from '../app/lib/password.server';

const email = process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.PLATFORM_ADMIN_PASSWORD ?? '';

if (!email || password.length < 12) {
  console.error('Set PLATFORM_ADMIN_EMAIL and a PLATFORM_ADMIN_PASSWORD of at least 12 characters, then run this command again.');
  process.exit(1);
}

await db.platformAdmin.upsert({
  where: {email},
  create: {email, passwordHash: hashPassword(password)},
  update: {passwordHash: hashPassword(password)},
});

console.log('Platform administrator saved.');
await db.$disconnect();
