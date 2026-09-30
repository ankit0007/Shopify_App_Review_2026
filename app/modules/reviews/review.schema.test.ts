import {describe, expect, it} from 'vitest';
import {publicReviewSubmissionSchema, reviewSubmissionSchema} from './review.schema';

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

  it('requires a public review to have a name and at least 10 characters', () => {
    expect(publicReviewSubmissionSchema.safeParse({rating: 5, body: 'Too short', displayName: 'Ankit'}).success).toBe(false);
    expect(publicReviewSubmissionSchema.safeParse({rating: 5, body: 'Long enough review', displayName: ''}).success).toBe(false);
    expect(publicReviewSubmissionSchema.parse({rating: 4, body: 'Long enough review', displayName: 'Ankit S.'}).displayName).toBe('Ankit S.');
  });
});
