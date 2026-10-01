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

export function displayOrderNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('#')) return trimmed;
  return /^\d+$/.test(trimmed) ? `#${trimmed}` : trimmed;
}

export function productCardsHtml(products: Array<{ title: string; variantTitle?: string | null; imageUrl?: string | null; reviewUrl?: string | null }>) {
  return products.map((product) => {
    const title = escapeHtml(product.title);
    const variant = product.variantTitle && product.variantTitle !== 'Default Title' ? `<div style="font-weight:400;font-size:13px;color:#6d7175;">${escapeHtml(product.variantTitle)}</div>` : '';
    const image = product.imageUrl && product.imageUrl.startsWith('https://')
      ? `<img src="${escapeHtml(product.imageUrl)}" alt="${title}" width="72" height="72" style="display:block;width:72px;height:72px;border-radius:8px;object-fit:cover;border:0;" />`
      : '<div style="width:72px;height:72px;border-radius:8px;background:#f1f2f3;"></div>';
    const button = product.reviewUrl && product.reviewUrl.startsWith('https://')
      ? `<a href="${escapeHtml(product.reviewUrl)}" style="display:inline-block;margin-top:8px;background:#111111;color:#ffffff;text-decoration:none;font-weight:700;font-size:13px;line-height:1;padding:10px 14px;border-radius:8px;">Write a review</a>`
      : '';
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px;border:1px solid #e3e3e3;border-radius:12px;"><tr><td width="96" valign="top" style="padding:12px;">${image}</td><td valign="middle" style="padding:12px 16px 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.4;font-weight:700;color:#202223;">${title}${variant}${button}</td></tr></table>`;
  }).join('');
}

export const reviewRequestHtmlTemplate = `<!DOCTYPE html><html lang="en"><body style="margin:0;padding:0;background:#f4f4f5;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;"><tr><td align="center" style="padding:24px 12px;"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border:1px solid #e3e3e3;border-radius:16px;"><tr><td style="padding:28px 28px 8px;font-family:Arial,Helvetica,sans-serif;"><p style="margin:0;font-size:13px;font-weight:700;letter-spacing:0.08em;color:#111111;">ARTIFYANNI</p><h1 style="margin:16px 0 8px;font-size:24px;line-height:1.3;color:#111111;">How was your purchase?</h1><p style="margin:0 0 8px;font-size:15px;line-height:1.5;color:#202223;">Hi {{customerName}},</p><p style="margin:0;font-size:15px;line-height:1.5;color:#202223;">We would love your review of the products from order {{orderNumber}}. Every product from this order is on one page.</p></td></tr><tr><td style="padding:20px 28px 8px;">{{productsHtml}}</td></tr><tr><td style="padding:8px 28px 28px;font-family:Arial,Helvetica,sans-serif;"><a href="{{reviewUrl}}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;line-height:1;padding:14px 22px;border-radius:8px;">Write a review</a><p style="margin:18px 0 0;font-size:12px;line-height:1.5;color:#6d7175;">If you would rather not get review requests, you can <a href="{{unsubscribeUrl}}" style="color:#6d7175;">unsubscribe</a>.</p></td></tr></table></td></tr></table></body></html>`;

export const reviewRequestTextTemplate = `Hi {{customerName}},

We would love your review of the products from order {{orderNumber}}.

{{productName}}

Write a review: {{reviewUrl}}

Unsubscribe: {{unsubscribeUrl}}`;

export function sanitizeTemplateSource(source: string) {
  return source.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
}
