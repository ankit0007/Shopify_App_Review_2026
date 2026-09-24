import {PrismaClient} from '@prisma/client';

const db = new PrismaClient();

async function main() {
  const shopDomain = process.env.SEED_SHOP_DOMAIN;
  if (!shopDomain) {
    console.log('Set SEED_SHOP_DOMAIN to seed a development shop.');
    return;
  }
  const shop = await db.shop.upsert({
    where: {shopDomain},
    update: {},
    create: {shopDomain},
  });
  await db.shopSettings.upsert({
    where: {shopId: shop.id},
    update: {},
    create: {shopId: shop.id},
  });
}

await main();
await db.$disconnect();
