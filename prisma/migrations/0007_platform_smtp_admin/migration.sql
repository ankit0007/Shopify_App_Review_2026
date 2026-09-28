CREATE TABLE "PlatformAdmin" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlatformAdmin_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformAdmin_email_key" ON "PlatformAdmin"("email");

CREATE TABLE "PlatformSession" (
  "id" TEXT NOT NULL,
  "adminId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "csrfToken" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformSession_tokenHash_key" ON "PlatformSession"("tokenHash");
CREATE INDEX "PlatformSession_adminId_idx" ON "PlatformSession"("adminId");
ALTER TABLE "PlatformSession" ADD CONSTRAINT "PlatformSession_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "PlatformAdmin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SmtpConfiguration" (
  "id" TEXT NOT NULL DEFAULT 'platform',
  "host" TEXT NOT NULL,
  "port" INTEGER NOT NULL,
  "username" TEXT NOT NULL,
  "encryptedPassword" TEXT NOT NULL,
  "encryptionMode" TEXT NOT NULL,
  "fromName" TEXT NOT NULL,
  "fromEmail" TEXT NOT NULL,
  "replyTo" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "lastTestedAt" TIMESTAMP(3),
  "lastTestStatus" TEXT,
  "lastTestError" TEXT,
  CONSTRAINT "SmtpConfiguration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformEmailTemplate" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "htmlBody" TEXT NOT NULL,
  "textBody" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlatformEmailTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformEmailTemplate_type_key" ON "PlatformEmailTemplate"("type");

CREATE TABLE "EmailDelivery" (
  "id" TEXT NOT NULL,
  "shopId" TEXT,
  "reviewRequestId" TEXT,
  "templateType" TEXT NOT NULL,
  "recipientHash" TEXT NOT NULL,
  "recipientMasked" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3),
  "failureReason" TEXT,
  "providerResponse" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedAt" TIMESTAMP(3),
  CONSTRAINT "EmailDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmailDelivery_status_nextAttemptAt_idx" ON "EmailDelivery"("status", "nextAttemptAt");
CREATE INDEX "EmailDelivery_createdAt_idx" ON "EmailDelivery"("createdAt");
ALTER TABLE "EmailDelivery" ADD CONSTRAINT "EmailDelivery_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PlatformAuditLog" (
  "id" TEXT NOT NULL,
  "adminId" TEXT,
  "action" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlatformAuditLog_createdAt_idx" ON "PlatformAuditLog"("createdAt");
ALTER TABLE "PlatformAuditLog" ADD CONSTRAINT "PlatformAuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "PlatformAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "PlatformEmailTemplate" ("id", "type", "subject", "htmlBody", "textBody", "enabled", "createdAt", "updatedAt") VALUES
('tmpl_review_request', 'REVIEW_REQUEST', 'How was {{productName}}?', '<p>Hi {{customerName}},</p><p>Please review {{productName}} from {{shopName}}.</p><p><a href="{{reviewUrl}}">Write a review</a></p><p><a href="{{unsubscribeUrl}}">Unsubscribe</a></p>', 'Hi {{customerName}}, review {{productName}} from {{shopName}}: {{reviewUrl}}. Unsubscribe: {{unsubscribeUrl}}', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('tmpl_review_reminder_1', 'REVIEW_REMINDER_1', 'Reminder: review {{productName}}', '<p>Hi {{customerName}}, this is a reminder to review {{productName}}.</p><p><a href="{{reviewUrl}}">Write a review</a></p>', 'Reminder to review {{productName}}: {{reviewUrl}}', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('tmpl_review_reminder_2', 'REVIEW_REMINDER_2', 'Final reminder: review {{productName}}', '<p>Hi {{customerName}}, this is the final reminder to review {{productName}}.</p><p><a href="{{reviewUrl}}">Write a review</a></p>', 'Final reminder to review {{productName}}: {{reviewUrl}}', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('tmpl_review_received', 'REVIEW_RECEIVED', 'We received your review', '<p>Hi {{customerName}}, we received your review of {{productName}}.</p>', 'We received your review of {{productName}}.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('tmpl_review_approved', 'REVIEW_APPROVED', 'Your review is published', '<p>Hi {{customerName}}, your review of {{productName}} is now published.</p>', 'Your review of {{productName}} is now published.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('tmpl_review_rejected', 'REVIEW_REJECTED', 'Your review was not published', '<p>Hi {{customerName}}, your review of {{productName}} was not published.</p>', 'Your review of {{productName}} was not published.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
