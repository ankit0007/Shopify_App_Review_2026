import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {histogramBarPercents, maxHistogramCount} from './histogram';

describe('review histogram widths', () => {
  it('sizes each bar against the largest bucket, not the review total', () => {
    const distribution = {'5': 1, '4': 2, '3': 0, '2': 1, '1': 0};
    expect(maxHistogramCount(distribution)).toBe(2);
    expect(histogramBarPercents(distribution)).toEqual({5: 50, 4: 100, 3: 0, 2: 50, 1: 0});
  });

  it('keeps every bar at 0% when there are no approved reviews', () => {
    expect(maxHistogramCount({'5': 0, '4': 0, '3': 0, '2': 0, '1': 0})).toBe(0);
    expect(histogramBarPercents(null)).toEqual({5: 0, 4: 0, 3: 0, 2: 0, 1: 0});
  });

  it('fills every bar when the buckets are equal', () => {
    expect(histogramBarPercents({'5': 4, '4': 4, '3': 4, '2': 4, '1': 4})).toEqual({5: 100, 4: 100, 3: 100, 2: 100, 1: 100});
  });

  it('gives the dominant rating the full bar', () => {
    expect(histogramBarPercents({'5': 100, '4': 50, '3': 20, '2': 5, '1': 1})).toEqual({5: 100, 4: 50, 3: 20, 2: 5, 1: 1});
  });

  it('uses the largest bucket in the storefront widget', () => {
    const source = readFileSync('app/storefront/review-widgets.js', 'utf8');
    expect(source).toContain('maxCount ? (amount / maxCount) * 100 : 0');
    expect(source).not.toContain('amount / count');
  });
});
