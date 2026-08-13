-- CreateTable
CREATE TABLE "public"."TagSection" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TagSection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TagSection_name_key" ON "public"."TagSection"("name");

-- Add "order" column to Tag (default 0 for existing rows)
ALTER TABLE "public"."Tag" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;

-- Add "sectionId" column to Tag (nullable initially)
ALTER TABLE "public"."Tag" ADD COLUMN "sectionId" TEXT;

-- Populate TagSection from distinct non-null category values
INSERT INTO "public"."TagSection" ("id", "name", "order", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  cat,
  ROW_NUMBER() OVER (ORDER BY cat),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "category" AS cat FROM "public"."Tag" WHERE "category" IS NOT NULL AND "category" != '') AS sub;

-- Link Tag.sectionId to TagSection.id based on matching name
UPDATE "public"."Tag" t
SET "sectionId" = ts."id"
FROM "public"."TagSection" ts
WHERE t."category" = ts."name";

-- Drop old category column
ALTER TABLE "public"."Tag" DROP COLUMN "category";

-- CreateIndex
CREATE INDEX "Tag_sectionId_idx" ON "public"."Tag"("sectionId");
