import {db} from '../../db.server';
import {reviewSubmissionSchema, type ReviewSubmission} from './review.schema';
import {verifyPurchase} from './verification.service.server';
import {PlanService} from '../plans/plan.service.server';

export async function submitReview(input: {
  shopId: string;
  reviewRequestId: string;
  productId: string;
  orderId?: string;
  customerId?: string;
  data: ReviewSubmission;
}) {
  const data = reviewSubmissionSchema.parse(input.data);
  const plan = new PlanService();
  const reviewLimit = await plan.checkLimit(input.shopId, 'reviews');
  if (!reviewLimit.allowed) throw new Error('Review limit reached');
  const verifiedPurchase = input.orderId
    ? await verifyPurchase({
      shopId: input.shopId,
      orderId: input.orderId,
      productId: input.productId,
      customerId: input.customerId,
    })
    : false;

  const review = await db.$transaction(async (tx) => {
    const request = await tx.reviewRequest.findFirst({
      where: {
        id: input.reviewRequestId,
        shopId: input.shopId,
        productId: input.productId,
        ...(input.orderId ? {orderId: input.orderId} : {}),
        ...(input.customerId ? {customerId: input.customerId} : {}),
        status: {notIn: ['CANCELLED', 'SUBMITTED', 'EXPIRED']},
      },
      select: {id: true},
    });
    if (!request) throw new Error('Review request is invalid or already used');

    const review = await tx.review.create({
      data: {
        shopId: input.shopId,
        productId: input.productId,
        orderId: input.orderId,
        customerId: input.customerId,
        reviewRequestId: input.reviewRequestId,
        rating: data.rating,
        title: data.title,
        body: data.body,
        displayName: data.displayName,
        verifiedPurchase,
        verificationReason: verifiedPurchase ? 'Matched eligible Shopify order item for this shop and customer' : 'No matching eligible Shopify order item',
      },
    });

    const updated = await tx.reviewRequest.updateMany({
      where: {id: input.reviewRequestId},
      data: {status: 'SUBMITTED'},
    });
    if (updated.count !== 1) throw new Error('Review request was already submitted');

    await tx.reviewEvent.create({
      data: {
        shopId: input.shopId,
        reviewId: review.id,
        reviewRequestId: input.reviewRequestId,
        action: 'SUBMITTED',
      },
    });

    return review;
  });
  await plan.increment(input.shopId, 'reviews');
  return review;
}
