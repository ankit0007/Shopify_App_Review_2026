import {db} from '../../db.server';
import {reviewSubmissionSchema, type ReviewSubmission} from './review.schema';
import {verifyPurchase} from './verification.service.server';

export async function submitReview(input: {
  shopId: string;
  reviewRequestId: string;
  productId: string;
  orderId?: string;
  customerId?: string;
  data: ReviewSubmission;
}) {
  const data = reviewSubmissionSchema.parse(input.data);
  const verifiedPurchase = input.orderId
    ? await verifyPurchase({
      shopId: input.shopId,
      orderId: input.orderId,
      productId: input.productId,
      customerId: input.customerId,
    })
    : false;

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
        verificationReason: verifiedPurchase ? 'Matched eligible Shopify order item for this shop and customer' : 'No matching eligible Shopify order item',
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
