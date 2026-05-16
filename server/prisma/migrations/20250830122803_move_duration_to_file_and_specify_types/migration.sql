/*
  Warnings:

  - You are about to drop the column `length` on the `Hymn` table. All the data in the column will be lost.
  - Changed the type of `type` on the `File` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "public"."FileType" AS ENUM ('AUDIO', 'DOCUMENT', 'POWERPOINT', 'VIDEO_MONTAGE', 'VIDEO_POWERPOINT');

-- AlterTable
ALTER TABLE "public"."File" ADD COLUMN     "duration" INTEGER,
DROP COLUMN "type",
ADD COLUMN     "type" "public"."FileType" NOT NULL;

-- AlterTable
ALTER TABLE "public"."Hymn" DROP COLUMN "length";
