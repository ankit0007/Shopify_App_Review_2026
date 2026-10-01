import {describe, expect, it} from 'vitest';
import {
  REVIEW_BUTTON_ORIENTATIONS,
  REVIEW_BUTTON_POSITIONS,
  reviewButtonOffset,
  validReviewButtonOrientation,
  validReviewButtonPosition,
} from './reviews-button';

describe('Reviews button settings', () => {
  it('supports every visual position and both orientations', () => {
    expect(REVIEW_BUTTON_POSITIONS.map(([value]) => value)).toEqual([
      'top-left', 'top-center', 'top-right',
      'middle-left', 'middle-center', 'middle-right',
      'bottom-left', 'bottom-center', 'bottom-right',
    ]);
    for (const [position] of REVIEW_BUTTON_POSITIONS) expect(validReviewButtonPosition(position)).toBe(true);
    for (const orientation of REVIEW_BUTTON_ORIENTATIONS) expect(validReviewButtonOrientation(orientation)).toBe(true);
    expect(validReviewButtonPosition('not-a-position')).toBe(false);
    expect(validReviewButtonOrientation('diagonal')).toBe(false);
  });

  it('validates offsets from 0 through 500 pixels', () => {
    expect(reviewButtonOffset(null)).toBeNull();
    expect(reviewButtonOffset('0')).toBe(0);
    expect(reviewButtonOffset('500')).toBe(500);
    expect(reviewButtonOffset('501')).toBeNull();
    expect(reviewButtonOffset('-1')).toBeNull();
    expect(reviewButtonOffset('10.5')).toBeNull();
  });
});
