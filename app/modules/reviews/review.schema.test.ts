import {describe, expect, it} from 'vitest';
import {reviewSubmissionSchema} from './review.schema';

describe('review submission validation', () => {
  it('accepts a valid 1-5 star review', () => {
    expect(reviewSubmissionSchema.parse({rating: 5, body: 'Excellent product'}).rating).toBe(5);
  });

  it('rejects ratings outside the allowed range', () => {
    expect(() => reviewSubmissionSchema.parse({rating: 6, body: 'Not valid'})).toThrow();
  });

  it('rejects empty review text', () => {
    expect(() => reviewSubmissionSchema.parse({rating: 4, body: ''})).toThrow();
  });
});
