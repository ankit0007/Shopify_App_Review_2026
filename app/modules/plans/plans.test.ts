import {describe, expect, it} from 'vitest';
import {getPlan, planForSubscription} from './plans';

describe('plan definitions', () => {
  it('uses the safe free plan for unknown handles', () => {
    expect(getPlan('unknown').handle).toBe('free');
  });

  it('keeps limits outside business logic', () => {
    expect(getPlan('growth').limits.reviews).toBe(2000);
    expect(getPlan('growth').features).toContain('video_ugc');
  });

  it('keeps paid plans inactive unless Shopify reports an active subscription', () => {
    expect(planForSubscription('not_configured', 'pro').handle).toBe('free');
    expect(planForSubscription('inactive', 'pro').handle).toBe('free');
    expect(planForSubscription('active', 'pro').handle).toBe('pro');
  });
});
