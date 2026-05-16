-- AlterTable
-- First add the column as nullable
ALTER TABLE "public"."Tag" ADD COLUMN     "updatedAt" TIMESTAMP(3);

-- Set updatedAt to createdAt for existing rows
UPDATE "public"."Tag" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;

-- Now make it NOT NULL
ALTER TABLE "public"."Tag" ALTER COLUMN "updatedAt" SET NOT NULL;
