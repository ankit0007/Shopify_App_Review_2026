import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {loader} from './_index';

describe('public pages', () => {
  it('keeps the Shopify shop open redirect and leaves a direct visit on the homepage', async () => {
    const opened = await loader({request: new Request('https://productreviews.it3.in/?shop=demo.myshopify.com')});
    expect(opened).toBeInstanceOf(Response);
    expect((opened as Response).status).toBeGreaterThanOrEqual(300);
    expect((opened as Response).headers.get('Location')).toContain('/app');
    expect(await loader({request: new Request('https://productreviews.it3.in/')})).toBeNull();
  });

  it('does not authenticate the public information routes', () => {
    const files = [
      'app/routes/public.tsx',
      'app/routes/_index.tsx',
      'app/routes/public.privacy.tsx',
      'app/routes/public.faq.tsx',
      'app/routes/public.changelog.tsx',
      'app/routes/public.tutorial.tsx',
      'app/routes/public.docs.tsx',
      'app/routes/public.support.tsx',
    ];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toContain('authenticate.admin');
      expect(source).not.toContain('example.com');
      expect(source).not.toContain('SHOPIFY_API_SECRET');
    }
  });
});
