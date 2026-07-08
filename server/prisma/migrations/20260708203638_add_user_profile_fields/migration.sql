-- Add profile fields to User model
ALTER TABLE "public"."User" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "public"."User" ADD COLUMN IF NOT EXISTS "full_name" TEXT;
ALTER TABLE "public"."User" ADD COLUMN IF NOT EXISTS "church_name" TEXT;
ALTER TABLE "public"."User" ADD COLUMN IF NOT EXISTS "church_role" TEXT;
ALTER TABLE "public"."User" ADD COLUMN IF NOT EXISTS "services" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "public"."User" ADD COLUMN IF NOT EXISTS "avatar_url" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "public"."User"("email");
