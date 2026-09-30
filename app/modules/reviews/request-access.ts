export function reviewLinkState(request: {expiresAt: Date | string | null; status: string} | null, now = new Date()) {
  if (!request) return 'invalid' as const;
  if (request.expiresAt && new Date(request.expiresAt).getTime() <= now.getTime()) return 'expired' as const;
  if (request.status === 'CANCELLED' || request.status === 'EXPIRED') return 'invalid' as const;
  return 'ready' as const;
}

export function sameOrderRequest(
  anchor: {shopId: string; orderId: string | null; customerId: string | null},
  target: {shopId: string; orderId: string | null; customerId: string | null},
) {
  return Boolean(anchor.orderId) &&
    anchor.shopId === target.shopId &&
    anchor.orderId === target.orderId &&
    anchor.customerId === target.customerId;
}
