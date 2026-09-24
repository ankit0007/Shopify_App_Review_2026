import type {Prisma} from '@prisma/client';
import {config} from '../config.server';
import {db} from '../db.server';
import {verifyWebhookHmac} from '../lib/webhook-hmac.server';

export async function action({request}: {request: Request}) {
  const rawBody = await request.text();
  if (!verifyWebhookHmac(rawBody, request.headers.get('x-shopify-hmac-sha256'), config.SHOPIFY_API_SECRET)) {
    return new Response('Unauthorized', {status: 401});
  }

  const topic = request.headers.get('x-shopify-topic') ?? 'unknown';
  const eventId = request.headers.get('x-shopify-event-id');
  const shopDomain = request.headers.get('x-shopify-shop-domain');
  if (!eventId) return new Response('Missing event id', {status: 400});

  const payload = JSON.parse(rawBody) as Prisma.InputJsonValue;
  const shop = shopDomain
    ? await db.shop.findUnique({where: {shopDomain}})
    : null;

  try {
    await db.webhookEvent.create({
      data: {eventId, topic, shopId: shop?.id, payload},
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return new Response('OK', {status: 200});
    }
    throw error;
  }

  if (topic === 'app/uninstalled' && shop) {
    await db.shop.update({
      where: {id: shop.id},
      data: {uninstalledAt: new Date()},
    });
  }

  if (topic === 'customers/redact' && shop) {
    const customer = payload as {customer?: {id?: unknown}};
    const customerId = typeof customer.customer?.id === 'number'
      ? String(customer.customer.id)
      : undefined;
    if (customerId) {
      await db.customer.deleteMany({
        where: {shopId: shop.id, shopifyCustomerId: customerId},
      });
    }
  }

  if (topic === 'shop/redact' && shop) {
    await db.shop.delete({where: {id: shop.id}});
  }

  return new Response('OK', {status: 200});
}
