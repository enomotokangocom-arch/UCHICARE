import { PrismaClient } from "@prisma/client";

declare global {
  var __uchiOsPrisma: PrismaClient | undefined;
}

// Next.js dev hot-reload creates a fresh module scope on every edit; without
// caching on `global` this would exhaust Postgres connections quickly.
export const prisma: PrismaClient =
  global.__uchiOsPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__uchiOsPrisma = prisma;
}
