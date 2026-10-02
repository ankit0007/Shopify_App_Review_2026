import {describe, expect, it} from 'vitest';
import {
  REVIEW_BUTTON_ORIENTATIONS,
  REVIEW_BUTTON_POSITIONS,
  reviewButtonOffset,
  reviewButtonPreviewStyle,
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

  it('moves the live preview with position, offsets, and orientation', () => {
    const initial = reviewButtonPreviewStyle('middle-right', 0, 50, 'vertical');
    expect(initial.right).toBe('0px');
    expect(initial.top).toBe('50%');
    expect(initial.left).toBeUndefined();
    expect(initial.bottom).toBeUndefined();
    expect(initial.width).toBe('max-content');
    expect(initial.height).toBe('max-content');
    expect(initial.writingMode).toBe('vertical-rl');
    const moved = reviewButtonPreviewStyle('top-left', 24, 40, 'horizontal');
    expect(moved.left).toBe('24px');
    expect(moved.top).toBe('40px');
    expect(moved.right).toBeUndefined();
    expect(moved.writingMode).toBe('horizontal-tb');
  });

  it('anchors every position without mixing opposite edges', () => {
    const expected = {
      'top-left': {top: '12px', left: '8px'},
      'top-center': {top: '12px', left: '50%'},
      'top-right': {top: '12px', right: '8px'},
      'middle-left': {top: '50%', left: '8px'},
      'middle-center': {top: '50%', left: '50%'},
      'middle-right': {top: '50%', right: '8px'},
      'bottom-left': {bottom: '12px', left: '8px'},
      'bottom-center': {bottom: '12px', left: '50%'},
      'bottom-right': {bottom: '12px', right: '8px'},
    };
    for (const [position, edges] of Object.entries(expected)) {
      const style = reviewButtonPreviewStyle(position as typeof REVIEW_BUTTON_POSITIONS[number][0], 8, 12, 'vertical');
      expect(style.top).toBe('top' in edges ? edges.top : undefined);
      expect(style.bottom).toBe('bottom' in edges ? edges.bottom : undefined);
      expect(style.left).toBe('left' in edges ? edges.left : undefined);
      expect(style.right).toBe('right' in edges ? edges.right : undefined);
      expect(style.width).toBe('max-content');
      expect(Boolean(style.left) && Boolean(style.right)).toBe(false);
      expect(Boolean(style.top) && Boolean(style.bottom)).toBe(false);
    }
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
