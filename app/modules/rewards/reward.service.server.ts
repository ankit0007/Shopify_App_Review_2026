export type RewardRule = {
  enabled: boolean;
  kind: 'DISCOUNT_AFTER_REVIEW' | 'DISCOUNT_AFTER_MEDIA_REVIEW';
  discountCodePrefix: string;
};

export interface RewardService {
  issue(input: {shopId: string; reviewId: string; rule: RewardRule}): Promise<{status: 'ISSUED'; providerId: string}>;
}

export class DisabledRewardService implements RewardService {
  async issue(): Promise<never> {
    throw new Error('Review rewards are not configured');
  }
}
