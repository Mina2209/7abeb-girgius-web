-- Brings the database in line with models that were only ever applied to dev via
-- `prisma db push` and never had a migration written: Father, Favorite (+ its enum)
-- and SiteSettings. Also adds the Tag.sectionId foreign key, which
-- 20260713120000_add_tag_sections_and_order created the column and index for but
-- never constrained.
--
-- Purely ADDITIVE. It deliberately does NOT include the DROP statements that
-- `prisma migrate diff` suggests for Lyric.search_vector, Lyric_search_vector_idx
-- and Image_titleNorm_trgm_idx: those objects are created in raw SQL by earlier
-- migrations, are invisible to schema.prisma, and are load-bearing for lyric
-- full-text search (services/lyric.service.js) and image title search
-- (services/image.service.js). Dropping them would silently degrade both.
-- It likewise leaves the ARRAY[] defaults on User.services and
-- ImageAuthor.specialty in place; Prisma Client always supplies a value, and the
-- defaults protect any raw-SQL insert.

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t
                 JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE t.typname = 'FavoriteContentType' AND n.nspname = 'public') THEN
    CREATE TYPE "public"."FavoriteContentType" AS ENUM ('HYMN', 'IMAGE', 'BOOK', 'SAYING');
  END IF;
END
$$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."Father" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "bio" TEXT,
    "profileImage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Father_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."Favorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contentType" "public"."FavoriteContentType" NOT NULL,
    "contentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."SiteSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "default_book_cover" TEXT NOT NULL,
    "site_sections_visibility" JSONB,
    "powerpoint_data" JSONB,
    "liturgy_data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Father_name_key" ON "public"."Father"("name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Favorite_userId_idx" ON "public"."Favorite"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Favorite_contentType_contentId_idx" ON "public"."Favorite"("contentType", "contentId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Favorite_userId_contentType_contentId_key" ON "public"."Favorite"("userId", "contentType", "contentId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Favorite_userId_fkey') THEN
    ALTER TABLE "public"."Favorite" ADD CONSTRAINT "Favorite_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

-- AddForeignKey
-- Missing since 20260713120000_add_tag_sections_and_order: the column and index were
-- created there, but the relation declared in schema.prisma was never enforced.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Tag_sectionId_fkey') THEN
    ALTER TABLE "public"."Tag" ADD CONSTRAINT "Tag_sectionId_fkey"
      FOREIGN KEY ("sectionId") REFERENCES "public"."TagSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
