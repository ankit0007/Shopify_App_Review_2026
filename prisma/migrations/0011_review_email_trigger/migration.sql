-- Merchants choose whether a review email starts after fulfillment or only after payment.
ALTER TABLE "ShopSettings" ADD COLUMN "reviewRequestTrigger" TEXT NOT NULL DEFAULT 'FULFILLMENT';

ALTER TABLE "Order" ADD COLUMN "financialStatus" TEXT;
ALTER TABLE "Order" ADD COLUMN "paidAt" TIMESTAMP(3);

UPDATE "PlatformEmailTemplate"
SET
  "subject" = 'How was your purchase? We''d love your review',
  "htmlBody" = $review_email$<!DOCTYPE html><html lang="en"><body style="margin:0;padding:0;background:#f4f4f5;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;"><tr><td align="center" style="padding:24px 12px;"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border:1px solid #e3e3e3;border-radius:16px;"><tr><td style="padding:28px 28px 8px;font-family:Arial,Helvetica,sans-serif;"><p style="margin:0;font-size:13px;font-weight:700;letter-spacing:0.08em;color:#111111;">ARTIFYANNI</p><h1 style="margin:16px 0 8px;font-size:24px;line-height:1.3;color:#111111;">How was your purchase?</h1><p style="margin:0 0 8px;font-size:15px;line-height:1.5;color:#202223;">Hi {{customerName}},</p><p style="margin:0;font-size:15px;line-height:1.5;color:#202223;">We would love your review of the products from order {{orderNumber}}. Every product from this order is on one page.</p></td></tr><tr><td style="padding:20px 28px 8px;">{{productsHtml}}</td></tr><tr><td style="padding:8px 28px 28px;font-family:Arial,Helvetica,sans-serif;"><a href="{{reviewUrl}}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;line-height:1;padding:14px 22px;border-radius:8px;">Write a review</a><p style="margin:18px 0 0;font-size:12px;line-height:1.5;color:#6d7175;">If you would rather not get review requests, you can <a href="{{unsubscribeUrl}}" style="color:#6d7175;">unsubscribe</a>.</p></td></tr></table></td></tr></table></body></html>$review_email$,
  "textBody" = $review_text$Hi {{customerName}},

We would love your review of the products from order {{orderNumber}}.

{{productName}}

Write a review: {{reviewUrl}}

Unsubscribe: {{unsubscribeUrl}}$review_text$,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "type" = 'REVIEW_REQUEST';

UPDATE "PlatformEmailTemplate"
SET
  "subject" = CASE "type" WHEN 'REVIEW_REMINDER_1' THEN 'Reminder: how was your purchase?' ELSE 'Final reminder: how was your purchase?' END,
  "htmlBody" = $review_email$<!DOCTYPE html><html lang="en"><body style="margin:0;padding:0;background:#f4f4f5;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;"><tr><td align="center" style="padding:24px 12px;"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border:1px solid #e3e3e3;border-radius:16px;"><tr><td style="padding:28px 28px 8px;font-family:Arial,Helvetica,sans-serif;"><p style="margin:0;font-size:13px;font-weight:700;letter-spacing:0.08em;color:#111111;">ARTIFYANNI</p><h1 style="margin:16px 0 8px;font-size:24px;line-height:1.3;color:#111111;">How was your purchase?</h1><p style="margin:0 0 8px;font-size:15px;line-height:1.5;color:#202223;">Hi {{customerName}},</p><p style="margin:0;font-size:15px;line-height:1.5;color:#202223;">We would love your review of the products from order {{orderNumber}}. Every product from this order is on one page.</p></td></tr><tr><td style="padding:20px 28px 8px;">{{productsHtml}}</td></tr><tr><td style="padding:8px 28px 28px;font-family:Arial,Helvetica,sans-serif;"><a href="{{reviewUrl}}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;line-height:1;padding:14px 22px;border-radius:8px;">Write a review</a><p style="margin:18px 0 0;font-size:12px;line-height:1.5;color:#6d7175;">If you would rather not get review requests, you can <a href="{{unsubscribeUrl}}" style="color:#6d7175;">unsubscribe</a>.</p></td></tr></table></td></tr></table></body></html>$review_email$,
  "textBody" = $review_text$Hi {{customerName}},

We would love your review of the products from order {{orderNumber}}.

{{productName}}

Write a review: {{reviewUrl}}

Unsubscribe: {{unsubscribeUrl}}$review_text$,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "type" IN ('REVIEW_REMINDER_1', 'REVIEW_REMINDER_2');
