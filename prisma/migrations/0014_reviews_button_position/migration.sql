ALTER TABLE "ShopSettings"
  ADD COLUMN "reviewsButtonEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "reviewsButtonPosition" TEXT NOT NULL DEFAULT 'middle-right',
  ADD COLUMN "reviewsButtonHorizontalOffset" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "reviewsButtonVerticalOffset" INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN "reviewsButtonOrientation" TEXT NOT NULL DEFAULT 'vertical';
