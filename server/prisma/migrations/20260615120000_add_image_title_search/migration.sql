-- Stage 1: indexed Arabic search for images.
-- Adds a normalized copy of the image title (via the existing normalize_arabic()
-- function), backfills existing rows, and creates a trigram GIN index for fast
-- substring search. The application keeps "titleNorm" in sync on create/update.
--
-- Additive and safe: it adds one nullable column + one index and backfills the new
-- column only. It does not touch existing data, columns, or the lyric search objects.
--
-- PRODUCTION note: pg_trgm must be creatable (it is on RDS via the master user).
-- On a very large Image table, consider building the index with CONCURRENTLY
-- manually + `prisma migrate resolve --applied 20260615120000_add_image_title_search`.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE "Image" ADD COLUMN IF NOT EXISTS "titleNorm" TEXT;

UPDATE "Image" SET "titleNorm" = normalize_arabic(title) WHERE "titleNorm" IS NULL;

CREATE INDEX IF NOT EXISTS "Image_titleNorm_trgm_idx" ON "Image" USING gin ("titleNorm" gin_trgm_ops);
