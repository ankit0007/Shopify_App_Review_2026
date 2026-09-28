export type ReviewFlowEvent =
  | 'review_submitted'
  | 'review_approved'
  | 'review_rejected'
  | 'review_request_sent'
  | 'review_request_clicked';

export interface FlowEventPublisher {
  publish(event: {shopId: string; name: ReviewFlowEvent; reviewId?: string; requestId?: string}): Promise<void>;
}

export class DisabledFlowEventPublisher implements FlowEventPublisher {
  async publish(): Promise<void> {
    // Flow support is intentionally disabled until a registered Shopify Flow
    // extension contract is configured.
  }
}
