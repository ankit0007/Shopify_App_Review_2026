import {db} from '../../db.server';

export async function moderateReview(input: {
  shopId: string;
  reviewId: string;
  action: 'APPROVE' | 'REJECT' | 'HIDE' | 'DELETE' | 'FEATURE';
  actorId?: string;
}) {
  const review = await db.review.findFirst({where: {id: input.reviewId, shopId: input.shopId}});
  if (!review) throw new Error('Review not found');

  const status = input.action === 'APPROVE'
    ? 'APPROVED'
    : input.action === 'REJECT'
      ? 'REJECTED'
      : input.action === 'HIDE'
        ? 'HIDDEN'
        : input.action === 'DELETE'
          ? 'DELETED'
          : review.status;

  return db.$transaction(async (tx) => {
    const updated = await tx.review.update({
      where: {id: review.id},
      data: {
        status,
        featured: input.action === 'FEATURE' ? true : review.featured,
        deletedAt: input.action === 'DELETE' ? new Date() : review.deletedAt,
      },
    });
    await tx.auditLog.create({
      data: {
        shopId: input.shopId,
        actorType: 'MERCHANT',
        actorId: input.actorId,
        action: input.action,
        entity: 'REVIEW',
        entityId: review.id,
      },
    });
    await tx.reviewEvent.create({
      data: {shopId: input.shopId, reviewId: review.id, action: input.action},
    });
    return updated;
  });
}
