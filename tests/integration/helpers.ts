import "dotenv/config";
import { createDb, type Db } from "@/mos/server/db";
import { seedMasters } from "@/mos/server/settings";
import type { ImportContext } from "@/mos/server/importService";

export const TEST_DB_URL = process.env.DATABASE_URL_TEST;
export const hasTestDb = Boolean(TEST_DB_URL);

let db: Db | null = null;
export function testDb(): Db {
  if (!db) db = createDb(TEST_DB_URL!);
  return db;
}

export async function resetDb(d: Db) {
  const tables = await d.$queryRawUnsafe<{ tablename: string }[]>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
  );
  await d.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
  await seedMasters(d);
}

export async function createUser(d: Db, role: "ADMIN" | "MANAGER" | "STAFF" = "ADMIN") {
  return d.user.create({ data: { email: `${role.toLowerCase()}-${Date.now()}@example.com`, name: role, passwordHash: "x", role } });
}

export function ctx(d: Db, userId: string | null = null, recalc = true): ImportContext {
  return { db: d, userId, origin: "REAL", hashSecret: "test-hash-secret-0123456789", recalc };
}
