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

export function reviewButtonPreviewStyle(
  position: ReviewButtonPosition,
  horizontalOffset: number,
  verticalOffset: number,
  orientation: ReviewButtonOrientation,
) {
  const [row, column] = position.split('-') as ['top' | 'middle' | 'bottom', 'left' | 'center' | 'right'];
  const transform = `${column === 'center' ? 'translateX(-50%)' : ''} ${row === 'middle' ? 'translateY(-50%)' : ''}`.trim() || undefined;
  return {
    position: 'absolute' as const,
    top: row === 'middle' ? '50%' : row === 'top' ? `${verticalOffset}px` : undefined,
    bottom: row === 'bottom' ? `${verticalOffset}px` : undefined,
    left: column === 'center' ? '50%' : column === 'left' ? `${horizontalOffset}px` : undefined,
    right: column === 'right' ? `${horizontalOffset}px` : undefined,
    marginTop: row === 'middle' ? `${verticalOffset - 50}px` : undefined,
    marginLeft: column === 'center' ? `${horizontalOffset}px` : undefined,
    transform,
    width: 'max-content',
    height: 'max-content',
    maxWidth: 'max-content',
    writingMode: orientation === 'vertical' ? 'vertical-rl' as const : 'horizontal-tb' as const,
  };
}

export function reviewButtonOffset(value: FormDataEntryValue | null) {
  if (value === null || String(value).trim() === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 500 ? parsed : null;
}
