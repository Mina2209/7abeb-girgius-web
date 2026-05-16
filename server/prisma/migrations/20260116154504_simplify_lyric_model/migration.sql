/*
  Warnings:

  - You are about to drop the column `language` on the `Lyric` table. All the data in the column will be lost.
  - You are about to drop the column `verseOrder` on the `Lyric` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[hymnId]` on the table `Lyric` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
-- DROP INDEX "public"."Lyric_hymnId_idx";

-- AlterTable
ALTER TABLE "public"."Lyric" DROP COLUMN "language",
DROP COLUMN "verseOrder";

-- CreateIndex
CREATE UNIQUE INDEX "Lyric_hymnId_key" ON "public"."Lyric"("hymnId");
