import {describe, expect, it} from 'vitest';
import {blockedByAcceptedDelivery, deliveryLabel} from './delivery-state';

describe('email delivery labels', () => {
  it('does not treat a queued or in-progress request as accepted', () => {
    expect(deliveryLabel('SCHEDULED')).toBe('QUEUED');
    expect(deliveryLabel('SCHEDULED', 1)).toBe('RETRYING');
    expect(deliveryLabel('SENDING')).toBe('RETRYING');
    expect(deliveryLabel('FAILED')).toBe('FAILED');
    expect(deliveryLabel('EXPIRED')).toBe('EXPIRED');
  });

  it('blocks a second send after the provider has accepted the message', () => {
    expect(blockedByAcceptedDelivery('ACCEPTED')).toBe(true);
    expect(blockedByAcceptedDelivery('FAILED')).toBe(false);
    expect(blockedByAcceptedDelivery(null)).toBe(false);
  });

  it('marks a request accepted only after the provider send status is recorded', () => {
    expect(deliveryLabel('SENT')).toBe('ACCEPTED');
  });
});
