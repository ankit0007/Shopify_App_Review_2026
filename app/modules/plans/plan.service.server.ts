import {db} from '../../db.server';
import {BillingService} from '../billing/billing.service.server';
import {getPlan} from './plans';

export class PlanService {
  private readonly billing = new BillingService();

  async getPlan(shopId: string) {
    const shop = await db.shop.findUnique({where: {id: shopId}, select: {shopifyShopId: true}});
    const subscription = await this.billing.getActiveSubscription(shop?.shopifyShopId ?? '');
    return subscription.plan;
  }

  async checkLimit(shopId: string, metric: 'reviews' | 'requests' | 'mediaBytes', increment = 1) {
    const plan = await this.getPlan(shopId);
    const periodStart = new Date();
    periodStart.setUTCDate(1);
    periodStart.setUTCHours(0, 0, 0, 0);
    const record = await db.usageRecord.findUnique({
      where: {shopId_metric_periodStart: {shopId, metric, periodStart}},
    });
    const current = record?.quantity ?? 0;
    const limit = getPlan(plan.handle).limits[metric];
    return {allowed: current + increment <= limit, current, limit};
  }

  async increment(shopId: string, metric: 'reviews' | 'requests' | 'mediaBytes', quantity = 1) {
    const periodStart = new Date();
    periodStart.setUTCDate(1);
    periodStart.setUTCHours(0, 0, 0, 0);
    return db.usageRecord.upsert({
      where: {shopId_metric_periodStart: {shopId, metric, periodStart}},
      create: {shopId, metric, periodStart, quantity},
      update: {quantity: {increment: quantity}},
    });
  }
}
