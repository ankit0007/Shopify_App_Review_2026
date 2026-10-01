-- New shops wait 2 days after the latest fulfillment. Existing saved delays stay as they are.
ALTER TABLE "ShopSettings" ALTER COLUMN "requestDelayDays" SET DEFAULT 2;

UPDATE "PlatformEmailTemplate"
SET
  "subject" = 'How was your purchase? We''d love your review',
  "htmlBody" = '<p>Hi {{customerName}},</p><p>Your order {{orderNumber}} from {{shopName}} has been fulfilled. We would love to hear what you think.</p>{{productsHtml}}<p><a href="{{reviewUrl}}">Review your purchases</a></p><p><a href="{{unsubscribeUrl}}">Unsubscribe from review requests</a></p>',
  "textBody" = 'Hi {{customerName}}, your order {{orderNumber}} from {{shopName}} has been fulfilled. Products: {{productName}}. Review your purchases: {{reviewUrl}}. Unsubscribe from review requests: {{unsubscribeUrl}}',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "type" = 'REVIEW_REQUEST'
  AND "subject" IN ('How was {{productName}}?', 'How was your purchase from {{shopName}}?');
