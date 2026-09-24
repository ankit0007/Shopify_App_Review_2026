import {describe, expect, it} from 'vitest';
import {getPlan} from './plans';

describe('plan definitions', () => {
  it('uses the safe free plan for unknown handles', () => {
    expect(getPlan('unknown').handle).toBe('free');
  });

  it('keeps limits outside business logic', () => {
    expect(getPlan('growth').limits.reviews).toBe(2000);
    expect(getPlan('growth').features).toContain('video_ugc');
  });
});
