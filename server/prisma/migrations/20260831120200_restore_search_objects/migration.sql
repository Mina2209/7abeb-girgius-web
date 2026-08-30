-- Restores the three raw-SQL search objects that are missing from production.
--
-- They were created by 20260116170000 and 20260615120000 and are recorded as applied,
-- but a later `prisma db push` against the production database removed them. db push
-- makes the database match schema.prisma exactly, and these objects are invisible to
-- schema.prisma -- a generated tsvector column and two index types Prisma cannot
-- express -- so it dropped them as drift. They are what makes Arabic lyric search and
-- indexed image-title search work.
--
-- Every statement is guarded, so this is a no-op on any database that still has them
-- (including a fresh one, where the two earlier migrations run first).
--
-- NOTE: never run `prisma db push` against production. It will drop these again.

-- normalize_arabic() is created by 20260116170000 and survived; the generated column
-- below depends on it.

-- Lyric full-text search vector (Arabic-normalized, generated, always in sync).
ALTER TABLE "public"."Lyric"
  ADD COLUMN IF NOT EXISTS "search_vector" tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', normalize_arabic(coalesce(content, '')))) STORED;

CREATE INDEX IF NOT EXISTS "Lyric_search_vector_idx"
  ON "public"."Lyric" USING GIN ("search_vector");

-- Trigram index backing substring search on the normalized image title.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Image_titleNorm_trgm_idx"
  ON "public"."Image" USING gin ("titleNorm" gin_trgm_ops);
