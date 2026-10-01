import { describe, expect, it } from 'vitest';
import { displayOrderNumber, productCardsHtml, renderTemplate, reviewRequestHtmlTemplate, sanitizeTemplateSource, templateTypeForReminder } from './template';

describe('email templates', () => {
  it('substitutes known variables and escapes HTML values', () => {
    const rendered = renderTemplate('<p>{{customerName}}</p>', { customerName: '<b>Ann</b>' }, 'html');
    expect(rendered).toBe('<p>&lt;b&gt;Ann&lt;/b&gt;</p>');
  });

  it('removes unknown variables instead of executing them', () => {
    expect(renderTemplate('{{process}} {{shopName}}', { shopName: 'Shop' }, 'text')).toBe(' Shop');
  });

  it('selects the review-request template from the reminder count', () => {
    expect(templateTypeForReminder(0)).toBe('REVIEW_REQUEST');
    expect(templateTypeForReminder(1)).toBe('REVIEW_REMINDER_1');
    expect(templateTypeForReminder(3)).toBe('REVIEW_REMINDER_2');
  });

  it('renders escaped product cards and leaves the prepared card HTML in place', () => {
    const cards = productCardsHtml([{ title: '<Snowboard>', imageUrl: 'https://cdn.shopify.com/board.jpg' }]);
    expect(cards).toContain('&lt;Snowboard&gt;');
    expect(cards).not.toContain('<Snowboard>');
    expect(cards).toContain('src="https://cdn.shopify.com/board.jpg"');
    expect(cards).toContain('width="72"');
    expect(productCardsHtml([{ title: 'Board', imageUrl: 'javascript:alert(1)' }])).not.toContain('javascript:');
    expect(renderTemplate(reviewRequestHtmlTemplate, { customerName: 'Ankit', orderNumber: '#1003', productsHtml: cards, reviewUrl: 'https://shopifyreview.it3.in/review-request/token', unsubscribeUrl: 'https://shopifyreview.it3.in/unsubscribe/token' }, 'html')).toContain('ARTIFYANNI');
    expect(renderTemplate(reviewRequestHtmlTemplate, { productsHtml: cards }, 'html')).toContain(cards);
    expect(displayOrderNumber('1003')).toBe('#1003');
    expect(displayOrderNumber('#1003')).toBe('#1003');
    expect(displayOrderNumber('TEST-1001')).toBe('TEST-1001');
    expect(renderTemplate('Order {{orderNumber}}', { orderNumber: '1045' }, 'text')).toBe('Order 1045');
  });

  it('strips script tags from stored templates', () => {
    expect(sanitizeTemplateSource('<p>Hi</p><script>alert(1)</script>')).toBe('<p>Hi</p>');
  });
});
