/*
  Warnings:

  - The values [AUDIO,DOCUMENT] on the enum `FileType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `attributes` on the `Hymn` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."FileType_new" AS ENUM ('VIDEO_MONTAGE', 'VIDEO_POWERPOINT', 'POWERPOINT', 'MUSIC_AUDIO', 'WORD_DOCUMENT');
ALTER TABLE "public"."File" ALTER COLUMN "type" TYPE "public"."FileType_new" USING ("type"::text::"public"."FileType_new");
ALTER TYPE "public"."FileType" RENAME TO "FileType_old";
ALTER TYPE "public"."FileType_new" RENAME TO "FileType";
DROP TYPE "public"."FileType_old";
COMMIT;

-- AlterTable
ALTER TABLE "public"."Hymn" DROP COLUMN "attributes";

-- CreateTable
CREATE TABLE "public"."Saying" (
    "id" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "authorImage" TEXT,
    "source" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Saying_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."_SayingToTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_SayingToTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_SayingToTag_B_index" ON "public"."_SayingToTag"("B");

-- AddForeignKey
ALTER TABLE "public"."_SayingToTag" ADD CONSTRAINT "_SayingToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Saying"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_SayingToTag" ADD CONSTRAINT "_SayingToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
