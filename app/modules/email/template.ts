export const templateVariables = ['shopName', 'customerName', 'productName', 'reviewUrl', 'unsubscribeUrl'] as const;

export function templateTypeForReminder(reminderCount: number) {
  if (reminderCount >= 2) return 'REVIEW_REMINDER_2';
  if (reminderCount === 1) return 'REVIEW_REMINDER_1';
  return 'REVIEW_REQUEST';
}

export function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderTemplate(source: string, variables: Partial<Record<(typeof templateVariables)[number], string>>, mode: 'html' | 'text') {
  return source.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    if (!templateVariables.includes(key as (typeof templateVariables)[number])) return '';
    const value = variables[key as (typeof templateVariables)[number]] ?? '';
    return mode === 'html' ? escapeHtml(value) : value;
  });
}

export function sanitizeTemplateSource(source: string) {
  return source.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
}
