import {Prisma} from '@prisma/client';
import {db} from '../db.server';

function isUniqueConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export async function ensureShop(shopDomain: string) {
  const shop = await db.shop.upsert({
    where: {shopDomain},
    update: {uninstalledAt: null},
    create: {shopDomain},
  }).catch(async (error: unknown) => {
    if (!isUniqueConflict(error)) throw error;
    return db.shop.findUniqueOrThrow({where: {shopDomain}});
  });

  await db.shopSettings.upsert({
    where: {shopId: shop.id},
    update: {},
    create: {shopId: shop.id},
  }).catch((error: unknown) => {
    if (!isUniqueConflict(error)) throw error;
  });

  return shop;
}
