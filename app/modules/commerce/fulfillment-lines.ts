export type ReviewableLine = {productId: string; title: string; quantity: number};

type LineItem = {
  product_id?: number | string | null;
  title?: string | null;
  quantity?: number | null;
  fulfillment_status?: string | null;
  gift_card?: boolean | null;
};

export type CommercePayload = {
  id?: number | string | null;
  order_id?: number | string | null;
  order_number?: number | null;
  fulfillment_status?: string | null;
  status?: string | null;
  fulfilled_at?: string | null;
  line_items?: LineItem[] | null;
};

export function shopifyOrderId(payload: CommercePayload) {
  if (payload.order_id != null && String(payload.order_id).trim()) return String(payload.order_id);
  if (payload.id != null && String(payload.id).trim()) return String(payload.id);
  return null;
}

export function isFulfillmentPayload(payload: CommercePayload) {
  return payload.order_id != null && String(payload.order_id).trim() !== '';
}

export function reviewableFulfilledLines(payload: CommercePayload): ReviewableLine[] {
  const fulfillment = isFulfillmentPayload(payload);
  if (fulfillment && payload.status && payload.status !== 'success' && payload.status !== 'fulfilled') return [];
  const orderFulfilled = !fulfillment && payload.fulfillment_status === 'fulfilled';
  const lines: ReviewableLine[] = [];
  const seen = new Set<string>();
  for (const item of payload.line_items ?? []) {
    if (item.gift_card) continue;
    const productId = item.product_id == null ? '' : String(item.product_id).trim();
    if (!/^\d{1,20}$/.test(productId) || seen.has(productId)) continue;
    const quantity = Number(item.quantity ?? 0);
    if (!Number.isInteger(quantity) || quantity < 1) continue;
    const lineFulfilled = fulfillment
      ? item.fulfillment_status == null || item.fulfillment_status === 'fulfilled'
      : item.fulfillment_status === 'fulfilled' || (orderFulfilled && item.fulfillment_status == null);
    if (!lineFulfilled) continue;
    seen.add(productId);
    lines.push({productId, title: item.title?.trim() || 'Product', quantity});
  }
  return lines;
}

export function requestStatusForLine(indexInNewBatch: number) {
  return indexInNewBatch === 0 ? 'SCHEDULED' as const : 'PENDING' as const;
}

export function automaticRequestsEnabled(value: boolean | null | undefined) {
  return value === true;
}

export function showWriteReviewButtonEnabled(value: boolean | null | undefined) {
  return value === true;
}
