import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

export type Db = PrismaClient;

export function createDb(connectionString: string): Db {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

const globalForDb = globalThis as unknown as { mosDb?: Db };

/** アプリ全体で共有する Prisma Client（開発時のホットリロードで接続が増えないよう global に保持） */
export function getDb(): Db {
  if (!globalForDb.mosDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL が設定されていません");
    globalForDb.mosDb = createDb(url);
  }
  return globalForDb.mosDb;
}

export function requireEnv(name: "MOS_SESSION_SECRET" | "MOS_HASH_SECRET" | "CRON_SECRET"): string {
  const v = process.env[name];
  if (!v || v.length < 16) throw new Error(`${name} が設定されていません（16文字以上）`);
  return v;
}
