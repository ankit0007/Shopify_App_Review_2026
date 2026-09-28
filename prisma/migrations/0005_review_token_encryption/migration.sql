ALTER TABLE "ReviewRequest" ADD COLUMN "tokenEncrypted" TEXT;

-- Existing requests cannot be sent safely because only their hashes were kept.
-- Preserve them as unusable until a merchant explicitly resends/recreates them.
UPDATE "ReviewRequest" SET "tokenEncrypted" = '' WHERE "tokenEncrypted" IS NULL;
ALTER TABLE "ReviewRequest" ALTER COLUMN "tokenEncrypted" SET NOT NULL;
