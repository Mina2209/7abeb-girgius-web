// READ-ONLY pre-flight audit for username/email case-insensitive normalization.
//
// Usage (from server/): node prisma/preflight-audit.js
//
// Runs only SELECT statements against the production DB using the project's
// existing @prisma/client + .env. Does NOT write, does NOT migrate, does NOT
// modify data, prints no connection string or credentials.

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function printLabel(id, title) {
  console.log(`\n===== ${id}: ${title} =====`);
}

function printRows(rows) {
  if (!rows || rows.length === 0) {
    console.log('  (none)');
    return;
  }
  console.log(JSON.stringify(rows, null, 2));
}

async function run() {
  // Q1 — Username collision after normalization (ALL usernames).
  // Normalization rule: trim -> local part before '@' -> lowercase.
  const q1 = await prisma.$queryRaw`
    SELECT
      LOWER(SPLIT_PART(username, '@', 1)) AS normalized_username,
      COUNT(*) AS cnt,
      ARRAY_AGG(id) AS ids
    FROM "User"
    GROUP BY 1
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC;
  `;

  printLabel('Q1', 'Username collisions after normalization — LOWER(SPLIT_PART(username, \'@\', 1))');
  console.log(`  collision groups: ${q1.length}`);
  printRows(q1);

  // Q2 — Email collision after LOWER(email).
  const q2 = await prisma.$queryRaw`
    SELECT
      LOWER(email) AS normalized_email,
      COUNT(*) AS cnt,
      ARRAY_AGG(id) AS ids
    FROM "User"
    WHERE email IS NOT NULL
      AND TRIM(email) <> ''
    GROUP BY 1
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC;
  `;

  printLabel('Q2', 'Email collisions after LOWER(email) (non-empty emails only)');
  console.log(`  collision groups: ${q2.length}`);
  printRows(q2);

  // Q3 — Usernames containing '@'.
  const q3 = await prisma.$queryRaw`
    SELECT
      id,
      username,
      LOWER(SPLIT_PART(username, '@', 1)) AS normalized_username
    FROM "User"
    WHERE username LIKE '%@%'
    ORDER BY username;
  `;

  printLabel('Q3', 'Usernames containing "@"');
  console.log(`  rows: ${q3.length}`);
  printRows(q3);

  // Q4 — Mixed-case usernames.
  const q4 = await prisma.$queryRaw`
    SELECT
      id,
      username
    FROM "User"
    WHERE username <> LOWER(username)
    ORDER BY username;
  `;

  printLabel('Q4', 'Mixed-case usernames');
  console.log(`  rows: ${q4.length}`);
  printRows(q4);

  // Q5 — Mixed-case emails.
  const q5 = await prisma.$queryRaw`
    SELECT
      id,
      email
    FROM "User"
    WHERE email IS NOT NULL
      AND email <> LOWER(email)
    ORDER BY email;
  `;

  printLabel('Q5', 'Mixed-case emails');
  console.log(`  rows: ${q5.length}`);
  printRows(q5);

  // Q6 — Usernames whose normalized local-part becomes empty.
  const q6 = await prisma.$queryRaw`
    SELECT
      id,
      username
    FROM "User"
    WHERE TRIM(SPLIT_PART(username, '@', 1)) = '';
  `;

  printLabel('Q6', 'Usernames whose normalized local part is empty');
  console.log(`  rows: ${q6.length}`);
  printRows(q6);

  // Q7 — Empty/whitespace emails.
  const q7 = await prisma.$queryRaw`
    SELECT
      id,
      email
    FROM "User"
    WHERE email IS NOT NULL
      AND TRIM(email) = '';
  `;

  printLabel('Q7', 'Empty / whitespace-only emails');
  console.log(`  rows: ${q7.length}`);
  printRows(q7);

  // Q8a — User.email / User.username columns.
  const q8a = await prisma.$queryRaw`
    SELECT
      column_name,
      is_nullable,
      data_type,
      character_maximum_length
    FROM information_schema.columns
    WHERE table_name = 'User'
      AND column_name IN ('username', 'email')
    ORDER BY ordinal_position;
  `;

  printLabel('Q8a', 'User columns (username / email)');
  printRows(q8a);

  // Q8b — Unique indexes on the User table.
  const q8b = await prisma.$queryRaw`
    SELECT
      indexname,
      indexdef
    FROM pg_indexes
    WHERE tablename = 'User'
      AND indexname LIKE '%_key'
    ORDER BY indexname;
  `;

  printLabel('Q8b', 'Unique indexes on "User"');
  printRows(q8b);

  // Summary.
  const q1Groups = q1.length;
  const q2Groups = q2.length;

  console.log('\n----- Collision summary -----');
  console.log(`Q1 username collision groups: ${q1Groups}`);
  console.log(`Q2 email collision groups:    ${q2Groups}`);

  if (q1Groups === 0 && q2Groups === 0) {
    console.log('\nPRE-FLIGHT PASSED — safe to proceed to implementation review.');
  } else {
    console.log('\nPRE-FLIGHT FAILED — collision detected. DO NOT RUN MIGRATION.');
  }
}

async function main() {
  try {
    await run();
  } catch (e) {
    console.error('\nERROR during pre-flight audit:', e && e.message ? e.message : e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();