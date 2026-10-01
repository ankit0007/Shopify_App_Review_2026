ALTER TYPE "ReviewRequestStatus" ADD VALUE 'BLOCKED';

ALTER TABLE "ReviewRequest" ADD COLUMN "isTest" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ReviewRequest" ADD COLUMN "testRecipientEncrypted" TEXT;

ALTER TABLE "OrderItem" ADD COLUMN "variantTitle" TEXT;
