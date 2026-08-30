-- Adds the VIEWER role. services/auth.service.js assigns this role to every
-- self-registered user, so registration fails outright without it.
--
-- Kept in its own migration so the new enum label is committed by a transaction
-- that never uses it. PostgreSQL 12+ permits ALTER TYPE ... ADD VALUE inside a
-- transaction block on that condition; on PG 11 and older it must run standalone.

-- AlterEnum
ALTER TYPE "public"."Role" ADD VALUE IF NOT EXISTS 'VIEWER';
