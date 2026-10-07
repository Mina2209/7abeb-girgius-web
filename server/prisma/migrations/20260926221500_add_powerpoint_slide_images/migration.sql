-- Per-slide preview images for PowerPoint/PPSX files.
--
-- Nullable and additive on purpose: previewUrl keeps pointing at the rendered PDF,
-- so the viewer can fall back to it for any slide whose image is missing and a
-- rollback is just clearing this column.
--
-- IF NOT EXISTS so re-running (the column was applied to the live database before
-- this file landed) is a harmless no-op rather than an error.
ALTER TABLE "File" ADD COLUMN IF NOT EXISTS "previewImageBaseUrl" TEXT;
