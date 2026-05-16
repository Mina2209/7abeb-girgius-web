/*
  Warnings:

  - The values [WORD_DOCUMENT] on the enum `FileType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."FileType_new" AS ENUM ('VIDEO_MONTAGE', 'VIDEO_POWERPOINT', 'POWERPOINT', 'MUSIC_AUDIO');
ALTER TABLE "public"."File" ALTER COLUMN "type" TYPE "public"."FileType_new" USING ("type"::text::"public"."FileType_new");
ALTER TYPE "public"."FileType" RENAME TO "FileType_old";
ALTER TYPE "public"."FileType_new" RENAME TO "FileType";
DROP TYPE "public"."FileType_old";
COMMIT;

-- CreateTable
CREATE TABLE "public"."Lyric" (
    "id" TEXT NOT NULL,
    "hymnId" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'ar',
    "content" TEXT NOT NULL,
    "verseOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lyric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lyric_hymnId_idx" ON "public"."Lyric"("hymnId");

-- AddForeignKey
ALTER TABLE "public"."Lyric" ADD CONSTRAINT "Lyric_hymnId_fkey" FOREIGN KEY ("hymnId") REFERENCES "public"."Hymn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add full-text search vector column (automatically computed from content)
ALTER TABLE "public"."Lyric" ADD COLUMN "search_vector" tsvector 
  GENERATED ALWAYS AS (to_tsvector('simple', coalesce(content, ''))) STORED;

-- Create GIN index for fast full-text search on lyrics
CREATE INDEX "Lyric_search_vector_idx" ON "public"."Lyric" USING GIN (search_vector);
