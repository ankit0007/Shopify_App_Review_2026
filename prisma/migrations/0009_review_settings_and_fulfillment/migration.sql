-- New shops stay opted out. Existing rows keep their current automaticRequests value.
ALTER TABLE "ShopSettings" ALTER COLUMN "automaticRequests" SET DEFAULT false;

ALTER TABLE "ShopSettings" ADD COLUMN "showWriteReviewButton" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "OrderItem" ADD COLUMN "fulfilledQuantity" INTEGER NOT NULL DEFAULT 0;

UPDATE "PlatformEmailTemplate"
SET
  "subject" = 'How was your purchase from {{shopName}}?',
  "htmlBody" = '<p>Hi {{customerName}},</p><p>Your order has been fulfilled. We would love to hear what you think about the products you received.</p><p>{{productName}}</p><p><a href="{{reviewUrl}}">Write a review</a></p><p><a href="{{unsubscribeUrl}}">Unsubscribe</a></p>',
  "textBody" = 'Hi {{customerName}}, your order from {{shopName}} has been fulfilled. Review the products you received: {{productName}}. Write a review: {{reviewUrl}}. Unsubscribe: {{unsubscribeUrl}}',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "type" = 'REVIEW_REQUEST' AND "subject" = 'How was {{productName}}?';
