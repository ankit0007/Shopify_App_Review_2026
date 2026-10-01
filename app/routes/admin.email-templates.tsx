import {Form, useActionData, useLoaderData, useOutletContext} from 'react-router';
import {db} from '../db.server';
import {assertCsrf, requirePlatformAdmin, writePlatformAudit} from '../modules/admin/session.server';
import {renderTemplate, sanitizeTemplateSource, templateVariables} from '../modules/email/template';

export async function loader({request}: {request: Request}) {
  await requirePlatformAdmin(request);
  const templates = await db.platformEmailTemplate.findMany({orderBy: {type: 'asc'}});
  return {templates, variables: templateVariables};
}

export async function action({request}: {request: Request}) {
  const session = await requirePlatformAdmin(request);
  const form = await request.formData();
  assertCsrf(session.csrfToken, form.get('csrfToken'));
  const type = String(form.get('type') ?? '');
  const template = await db.platformEmailTemplate.findUnique({where: {type}});
  if (!template) return {error: 'Template was not found.'};
  if (form.get('intent') === 'preview') {
    return {
      preview: renderTemplate(template.htmlBody, {
        shopName: 'Example Shop',
        customerName: 'Avery <Customer>',
        productName: 'Example Product',
        reviewUrl: 'https://productreviews.it3.in/review/example',
        unsubscribeUrl: 'https://productreviews.it3.in/unsubscribe/example',
      }, 'html'),
    };
  }
  await db.platformEmailTemplate.update({
    where: {type},
    data: {
      subject: sanitizeTemplateSource(String(form.get('subject') ?? '')).slice(0, 200),
      htmlBody: sanitizeTemplateSource(String(form.get('htmlBody') ?? '')),
      textBody: sanitizeTemplateSource(String(form.get('textBody') ?? '')),
      enabled: form.get('enabled') === 'on',
    },
  });
  await writePlatformAudit({adminId: session.adminId, action: 'EMAIL_TEMPLATE_UPDATED', metadata: {type}});
  return {message: `${type} saved.`};
}

export default function EmailTemplates() {
  const {templates, variables} = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const {csrfToken} = useOutletContext<{csrfToken: string}>();
  return (
    <section>
      <h1>Email templates</h1>
      <p>Available variables: {variables.map((name) => `{{${name}}}`).join(', ')}</p>
      {result && 'message' in result ? <p role="status">{result.message}</p> : null}
      {result && 'error' in result ? <p role="alert">{result.error}</p> : null}
      {result && 'preview' in result ? <iframe title="Template preview" sandbox="" srcDoc={result.preview} style={{width: '100%', minHeight: 160, border: '1px solid #ccc'}} /> : null}
      {templates.map((template) => (
        <Form method="post" key={template.id}>
          <input type="hidden" name="csrfToken" value={csrfToken} />
          <input type="hidden" name="type" value={template.type} />
          <h2>{template.type}</h2>
          <label>Subject<br /><input name="subject" defaultValue={template.subject} required /></label>
          <label>HTML body<br /><textarea name="htmlBody" rows={6} defaultValue={template.htmlBody} /></label>
          <label>Text body<br /><textarea name="textBody" rows={4} defaultValue={template.textBody} /></label>
          <label><input name="enabled" type="checkbox" defaultChecked={template.enabled} /> Enabled</label>
          <button type="submit" name="intent" value="save">Save</button>
          <button type="submit" name="intent" value="preview">Preview</button>
        </Form>
      ))}
    </section>
  );
}
