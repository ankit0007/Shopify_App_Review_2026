export type StarBucket = '1' | '2' | '3' | '4' | '5';

const STARS: StarBucket[] = ['1', '2', '3', '4', '5'];

export function histogramCounts(distribution: Partial<Record<StarBucket, number>> | null | undefined) {
  const counts = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0} as Record<StarBucket, number>;
  for (const star of STARS) {
    const value = Number(distribution?.[star]);
    counts[star] = Number.isFinite(value) && value > 0 ? value : 0;
  }
  return counts;
}

export function maxHistogramCount(distribution: Partial<Record<StarBucket, number>> | null | undefined) {
  const counts = histogramCounts(distribution);
  return Math.max(counts['1'], counts['2'], counts['3'], counts['4'], counts['5']);
}

export function histogramBarPercents(distribution: Partial<Record<StarBucket, number>> | null | undefined) {
  const counts = histogramCounts(distribution);
  const maxCount = maxHistogramCount(distribution);
  const percents = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0} as Record<StarBucket, number>;
  if (maxCount === 0) return percents;
  for (const star of STARS) percents[star] = (counts[star] / maxCount) * 100;
  return percents;
}
