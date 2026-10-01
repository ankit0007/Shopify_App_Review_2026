-- The site-wide Reviews tab is visible unless the merchant turns it off.
ALTER TABLE "ShopSettings" ADD COLUMN "showAllReviewsTab" BOOLEAN NOT NULL DEFAULT true;
