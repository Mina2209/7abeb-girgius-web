-- DropForeignKey
ALTER TABLE "public"."File" DROP CONSTRAINT "File_hymnId_fkey";

-- AddForeignKey
ALTER TABLE "public"."File" ADD CONSTRAINT "File_hymnId_fkey" FOREIGN KEY ("hymnId") REFERENCES "public"."Hymn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
