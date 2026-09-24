import {db} from '../../db.server';
import {reviewSubmissionSchema, type ReviewSubmission} from './review.schema';

export async function submitReview(input: {
  shopId: string;
  reviewRequestId: string;
  productId: string;
  orderId?: string;
  customerId?: string;
  data: ReviewSubmission;
}) {
  const data = reviewSubmissionSchema.parse(input.data);
  const verifiedPurchase = Boolean(input.orderId);

  return db.$transaction(async (tx) => {
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
        verificationReason: verifiedPurchase ? 'Matched eligible Shopify order item' : null,
      },
    });

    await tx.reviewRequest.update({
      where: {id: input.reviewRequestId},
      data: {status: 'SUBMITTED'},
    });

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
}
