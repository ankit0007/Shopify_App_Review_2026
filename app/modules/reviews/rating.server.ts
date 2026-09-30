import {db} from '../../db.server';
import {readRatingCache, writeRatingCache} from './rating-cache.server';
import {assemblePublicRatings, productGid, summarizeRatingCounts, type PublicRating, type RatingCount} from './rating';

export async function loadPublicRatings(shopDomain: string, productIds: string[]) {
  const ratings: Record<string, PublicRating> = {};
  const missing: string[] = [];
  for (const productId of productIds) {
    const cached = readRatingCache(shopDomain, productId);
    if (cached) ratings[productGid(productId)] = cached;
    else missing.push(productId);
  }
  if (missing.length === 0) return ratings;

  const products = await db.product.findMany({
    where: {shopifyProductId: {in: missing}, shop: {shopDomain}},
    select: {id: true, shopifyProductId: true},
  });
  const groups = products.length === 0 ? [] : await db.review.groupBy({
    by: ['productId', 'rating'],
    where: {
      productId: {in: products.map((product) => product.id)},
      status: 'APPROVED',
      deletedAt: null,
      shop: {shopDomain},
    },
    _count: {_all: true},
  });
  const countsByProductId: Record<string, RatingCount[]> = {};
  for (const product of products) {
    countsByProductId[product.shopifyProductId] = groups
      .filter((group) => group.productId === product.id)
      .map((group) => ({rating: group.rating, count: group._count._all}));
  }
  const assembled = assemblePublicRatings({
    requestedIds: missing,
    ownedProductIds: products.map((product) => product.shopifyProductId),
    countsByProductId,
  });
  for (const productId of missing) {
    const rating = assembled[productGid(productId)] ?? {averageRating: null, reviewCount: 0};
    writeRatingCache(shopDomain, productId, rating);
    ratings[productGid(productId)] = rating;
  }
  return ratings;
}

export async function listProductRatingSummaries(shopId: string) {
  const products = await db.product.findMany({
    where: {shopId, reviews: {some: {status: 'APPROVED', deletedAt: null}}},
    select: {id: true, title: true, shopifyProductId: true},
    orderBy: {title: 'asc'},
    take: 20,
  });
  if (products.length === 0) return [];
  const groups = await db.review.groupBy({
    by: ['productId', 'rating'],
    where: {shopId, productId: {in: products.map((product) => product.id)}, status: 'APPROVED', deletedAt: null},
    _count: {_all: true},
  });
  return products.map((product) => ({
    title: product.title,
    shopifyProductId: product.shopifyProductId,
    ...summarizeRatingCounts(groups
      .filter((group) => group.productId === product.id)
      .map((group) => ({rating: group.rating, count: group._count._all}))),
  }));
}
