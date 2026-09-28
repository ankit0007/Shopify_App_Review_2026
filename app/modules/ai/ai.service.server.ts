export type ReviewSummary = {summary: string; topics: string[]};

export interface AiProvider {
  summarizeReviews(input: {productTitle: string; reviews: Array<{rating: number; body: string}>}): Promise<ReviewSummary>;
}

export class DisabledAiProvider implements AiProvider {
  async summarizeReviews(): Promise<ReviewSummary> {
    throw new Error('AI provider is not configured');
  }
}
