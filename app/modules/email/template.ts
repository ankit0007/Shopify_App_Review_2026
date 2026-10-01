export const templateVariables = ['shopName', 'customerName', 'productName', 'orderNumber', 'reviewUrl', 'unsubscribeUrl', 'productsHtml'] as const;
const rawHtmlVariables = new Set(['productsHtml']);

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
    if (mode === 'html' && rawHtmlVariables.has(key)) return value;
    return mode === 'html' ? escapeHtml(value) : value;
  });
}

export function productCardsHtml(products: Array<{title: string; imageUrl?: string | null}>) {
  return products.map((product) => {
    const title = escapeHtml(product.title);
    const image = product.imageUrl && product.imageUrl.startsWith('https://')
      ? `<img src="${escapeHtml(product.imageUrl)}" alt="" width="64" height="64" />`
      : '';
    return `<p>${image}${title}</p>`;
  }).join('');
}

export function sanitizeTemplateSource(source: string) {
  return source.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
}
