-- Merchants choose whether a review email starts after fulfillment or only after payment.
ALTER TABLE "ShopSettings" ADD COLUMN "reviewRequestTrigger" TEXT NOT NULL DEFAULT 'FULFILLMENT';

ALTER TABLE "Order" ADD COLUMN "financialStatus" TEXT;
ALTER TABLE "Order" ADD COLUMN "paidAt" TIMESTAMP(3);
