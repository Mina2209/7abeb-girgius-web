import { PrismaClient } from '@prisma/client';

// Single shared Prisma client for the entire server process.
// Each `new PrismaClient()` opens its own connection pool, so instantiating it
// per-module can exhaust the database's connection limit under load. Every
// service and the app entry point should import THIS instance.
export const prisma = new PrismaClient();

export default prisma;
