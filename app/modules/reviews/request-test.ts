export const PROTECTED_CUSTOMER_DATA_REASON = 'Protected customer data access required';
export const DEFAULT_TEST_RECIPIENT = 'ankit.friend07@gmail.com';

export function parseOrderNumber(value: string) {
  const trimmed = value.trim().replace(/^#/, '');
  return /^\d{1,10}$/.test(trimmed) ? trimmed : null;
}

export function parseTestRecipient(value: string) {
  const email = value.trim().toLowerCase();
  return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email) ? email : null;
}

export function resolveReviewRecipient(input: {
  mode: 'automatic' | 'test';
  customerEmail: string | null;
  testRecipient: string | null;
}) {
  if (input.mode === 'test') {
    const testRecipient = input.testRecipient ? parseTestRecipient(input.testRecipient) : null;
    if (!testRecipient) return {ok: false as const, blocked: false, reason: 'Enter a valid TEST recipient.'};
    return {ok: true as const, recipient: testRecipient, test: true as const};
  }
  const customerEmail = input.customerEmail ? parseTestRecipient(input.customerEmail) : null;
  if (!customerEmail) return {ok: false as const, blocked: true, reason: PROTECTED_CUSTOMER_DATA_REASON};
  return {ok: true as const, recipient: customerEmail, test: false as const};
}

export function safeShopifyMessage(message: string) {
  return message
    .replace(/shpat_[A-Za-z0-9]+/gi, '[redacted]')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[redacted]')
    .slice(0, 300);
}

export function reviewEmailAlreadySent(status: string, sentAt: Date | null | undefined) {
  return ['SENT', 'OPENED', 'CLICKED', 'SUBMITTED', 'SENDING'].includes(status) || sentAt != null;
}

export function productReviewDone(
  product: {id: string; submitted: boolean},
  result: {productId?: string; submitted?: boolean} | null | undefined,
) {
  return product.submitted || (result?.submitted === true && result.productId === product.id);
}
