import {Prisma} from '@prisma/client';
import {config} from '../config.server';
import {db} from '../db.server';
import {verifyWebhookHmac} from '../lib/webhook-hmac.server';
import {collectCustomerData, eraseCustomerData} from '../modules/privacy/privacy.service.server';

export async function action({request}: {request: Request}) {
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 2_000_000) return new Response('Payload too large', {status: 413});
  const rawBody = await request.text();
  if (!verifyWebhookHmac(rawBody, request.headers.get('x-shopify-hmac-sha256'), config.SHOPIFY_API_SECRET)) {
    return new Response('Unauthorized', {status: 401});
  }

  const topic = request.headers.get('x-shopify-topic') ?? 'unknown';
  const eventId = request.headers.get('x-shopify-event-id');
  const shopDomain = request.headers.get('x-shopify-shop-domain');
  if (!eventId) return new Response('Missing event id', {status: 400});

  let payload: Prisma.InputJsonValue;
  try {
    payload = JSON.parse(rawBody) as Prisma.InputJsonValue;
  } catch {
    return new Response('Invalid JSON', {status: 400});
  }
  const shop = shopDomain
    ? await db.shop.findUnique({where: {shopDomain}})
    : null;
  if (!shop) {
    if (['customers/data_request', 'customers/redact', 'shop/redact', 'app/uninstalled'].includes(topic)) {
      return new Response('OK', {status: 200});
    }
    return new Response('Unknown shop', {status: 404});
  }
  const privacyPayload = payload as {customer?: {id?: number | string}};

  try {
    await db.webhookEvent.create({
      data: {eventId, topic, shopId: shop?.id, payload},
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return new Response('OK', {status: 200});
    }
    throw error;
  }

  if (topic === 'app/uninstalled' && shop) {
    await db.shop.update({
      where: {id: shop.id},
      data: {uninstalledAt: new Date()},
    });
    await db.reviewRequest.updateMany({
      where: {shopId: shop.id, status: {in: ['PENDING', 'SCHEDULED', 'SENDING']}},
      data: {status: 'CANCELLED', lastError: 'Shop uninstalled'},
    });
  }

  if (['customers/data_request', 'customers/redact'].includes(topic) && shop) {
    const customerId = privacyPayload.customer?.id !== undefined
      ? String(privacyPayload.customer.id)
      : undefined;
    const exportData = topic === 'customers/data_request' && customerId
      ? await collectCustomerData(shop.id, customerId)
      : undefined;
    await db.privacyRequest.create({
      data: {
        shopId: shop.id,
        topic,
        customerShopifyId: customerId,
        data: exportData as Prisma.InputJsonValue | undefined,
        status: topic === 'customers/data_request' || topic === 'customers/redact' ? 'PROCESSED' : 'RECEIVED',
        processedAt: new Date(),
      },
    });
  }

  if (topic === 'customers/redact' && shop) {
    const customerId = privacyPayload.customer?.id !== undefined
      ? String(privacyPayload.customer.id)
      : undefined;
    if (customerId) {
      await eraseCustomerData(shop.id, customerId);
    }
  }

  if (topic === 'shop/redact' && shop) {
    await db.shop.delete({where: {id: shop.id}});
  }

  return new Response('OK', {status: 200});
}
