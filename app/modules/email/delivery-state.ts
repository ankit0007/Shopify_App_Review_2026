export type DeliveryLabel = 'QUEUED' | 'ACCEPTED' | 'FAILED' | 'RETRYING' | 'EXPIRED' | 'CANCELLED' | 'SUBMITTED';

export function blockedByAcceptedDelivery(status: string | null) {
  return status === 'ACCEPTED';
}

export function deliveryLabel(status: string, reminderCount = 0): DeliveryLabel | string {
  if (status === 'SCHEDULED') return reminderCount > 0 ? 'RETRYING' : 'QUEUED';
  if (status === 'SENDING') return 'RETRYING';
  if (status === 'SENT' || status === 'OPENED' || status === 'CLICKED') return 'ACCEPTED';
  if (status === 'FAILED') return 'FAILED';
  if (status === 'BLOCKED') return 'BLOCKED';
  if (status === 'EXPIRED') return 'EXPIRED';
  if (status === 'CANCELLED') return 'CANCELLED';
  if (status === 'SUBMITTED') return 'SUBMITTED';
  return status;
}
