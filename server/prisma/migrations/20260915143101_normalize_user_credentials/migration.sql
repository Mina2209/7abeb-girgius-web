-- Normalize existing user credentials to lowercase.
-- Makes usernames/emails case-insensitive going forward.
--
-- Pre-flight audit confirmed safe (read-only, run ahead of this migration):
--   Q1 username lowercase collision groups = 0
--   Q2 email lowercase collision groups    = 0
--   Q3 usernames containing '@'            = 0
--   Q6 usernames that are empty            = 0
--   Q7 emails that are empty               = 0
--
-- IMPORTANT (per pre-flight): there were ZERO usernames containing '@', so no
-- SPLIT_PART / local-part extraction step is needed here. Only LOWER() is used.
--
-- This migration only lowercases existing values. It does NOT:
--   - change the schema (no schema.prisma edits, no unique/index changes)
--   - alter passwords, IDs, roles, permissions, profile data, or relations
--   - drop or modify any table/column

UPDATE "User"
SET username = LOWER(username)
WHERE username <> LOWER(username);

UPDATE "User"
SET email = LOWER(email)
WHERE email IS NOT NULL
  AND email <> LOWER(email);
