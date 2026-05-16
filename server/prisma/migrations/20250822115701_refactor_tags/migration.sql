/*
  Warnings:

  - You are about to drop the column `tags` on the `Hymn` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Hymn" DROP COLUMN "tags";

-- CreateTable
CREATE TABLE "public"."Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."_HymnToTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_HymnToTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "public"."Tag"("name");

-- CreateIndex
CREATE INDEX "_HymnToTag_B_index" ON "public"."_HymnToTag"("B");

-- AddForeignKey
ALTER TABLE "public"."_HymnToTag" ADD CONSTRAINT "_HymnToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Hymn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_HymnToTag" ADD CONSTRAINT "_HymnToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
