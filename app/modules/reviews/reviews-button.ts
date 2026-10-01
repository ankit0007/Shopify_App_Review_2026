export const REVIEW_BUTTON_POSITIONS = [
  ['top-left', 'Top left'],
  ['top-center', 'Top center'],
  ['top-right', 'Top right'],
  ['middle-left', 'Middle left'],
  ['middle-center', 'Middle center'],
  ['middle-right', 'Middle right'],
  ['bottom-left', 'Bottom left'],
  ['bottom-center', 'Bottom center'],
  ['bottom-right', 'Bottom right'],
] as const;

export const REVIEW_BUTTON_ORIENTATIONS = ['vertical', 'horizontal'] as const;

export type ReviewButtonPosition = typeof REVIEW_BUTTON_POSITIONS[number][0];
export type ReviewButtonOrientation = typeof REVIEW_BUTTON_ORIENTATIONS[number];

export function validReviewButtonPosition(value: unknown): value is ReviewButtonPosition {
  return REVIEW_BUTTON_POSITIONS.some(([position]) => position === value);
}

export function validReviewButtonOrientation(value: unknown): value is ReviewButtonOrientation {
  return REVIEW_BUTTON_ORIENTATIONS.includes(value as ReviewButtonOrientation);
}

export function reviewButtonOffset(value: FormDataEntryValue | null) {
  if (value === null || String(value).trim() === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 500 ? parsed : null;
}
