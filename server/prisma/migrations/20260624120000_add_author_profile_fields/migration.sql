-- Extend ImageAuthor with full artist profile fields
-- All new columns are nullable for backward compatibility.

ALTER TABLE "ImageAuthor" ADD COLUMN IF NOT EXISTS "name" TEXT;
ALTER TABLE "ImageAuthor" ADD COLUMN IF NOT EXISTS "bio" TEXT;
ALTER TABLE "ImageAuthor" ADD COLUMN IF NOT EXISTS "role" TEXT;
ALTER TABLE "ImageAuthor" ADD COLUMN IF NOT EXISTS "profileImage" TEXT;
ALTER TABLE "ImageAuthor" ADD COLUMN IF NOT EXISTS "facebook" TEXT;
ALTER TABLE "ImageAuthor" ADD COLUMN IF NOT EXISTS "instagram" TEXT;
ALTER TABLE "ImageAuthor" ADD COLUMN IF NOT EXISTS "website" TEXT;
ALTER TABLE "ImageAuthor" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "ImageAuthor" ADD COLUMN IF NOT EXISTS "joinDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ImageAuthor" ADD COLUMN IF NOT EXISTS "specialty" TEXT[] DEFAULT ARRAY[]::TEXT[];
