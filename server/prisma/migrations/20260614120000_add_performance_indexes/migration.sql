-- Phase 1: Performance indexes for foreign-key / lookup columns.
-- PostgreSQL does NOT auto-create indexes on FK columns; these are missing today.
-- This migration is purely ADDITIVE: it creates indexes only.
-- It touches no data, no columns, and no other database objects (search_vector,
-- normalize_arabic(), etc. are deliberately untouched).
--
-- NOTE for PRODUCTION rollout (large tables): plain CREATE INDEX takes a brief
-- write lock. For zero-downtime on prod, run the CONCURRENTLY variant manually via
-- psql and then record it with `prisma migrate resolve --applied 20260614120000_add_performance_indexes`,
-- because CREATE INDEX CONCURRENTLY cannot run inside Prisma's migration transaction.

CREATE INDEX IF NOT EXISTS "File_hymnId_idx"   ON "public"."File"("hymnId");
CREATE INDEX IF NOT EXISTS "Image_authorId_idx" ON "public"."Image"("authorId");
CREATE INDEX IF NOT EXISTS "Image_typeId_idx"   ON "public"."Image"("typeId");
CREATE INDEX IF NOT EXISTS "Log_userId_idx"     ON "public"."Log"("userId");
CREATE INDEX IF NOT EXISTS "Log_createdAt_idx"  ON "public"."Log"("createdAt");
