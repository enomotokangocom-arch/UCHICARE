import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { MIGRATIONS, SCHEMA_SQL } from "./schema";

/**
 * 入職前システム準備管理ツールのデータベース接続。
 *
 * - SQLite(Node.js 組み込みの node:sqlite)を使用し、`data/onboarding.db` に保存します。
 * - 環境変数 ONBOARDING_DB_PATH で保存先を変更できます(テストでは一時ファイルを使用)。
 * - WALモードとbusy_timeoutを設定し、複数リクエスト・複数プロセスからの同時書き込みに備えます。
 */

export type DB = DatabaseSync;

let cached: { path: string; db: DB } | null = null;

export function defaultDbPath(): string {
  return process.env.ONBOARDING_DB_PATH || path.join(process.cwd(), "data", "onboarding.db");
}

export function openDb(dbPath: string = defaultDbPath()): DB {
  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA busy_timeout = 5000;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA_SQL);
  for (const m of MIGRATIONS) {
    const cols = db.prepare(`PRAGMA table_info(${m.table})`).all() as { name: string }[];
    if (!cols.some((c) => c.name === m.column)) db.exec(m.ddl);
  }
  return db;
}

/** アプリ(Route Handler)から使う共有接続 */
export function getDb(): DB {
  const p = defaultDbPath();
  if (!cached || cached.path !== p) {
    cached = { path: p, db: openDb(p) };
  }
  return cached.db;
}

/**
 * 書き込みトランザクション。BEGIN IMMEDIATE で書き込みロックを先に取得するため、
 * 「最大番号を読んで次の番号を登録する」ような処理を複数人が同時に行っても重複しません。
 */
export function tx<T>(db: DB, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function todayStr(d: Date = new Date()): string {
  // 日本時間の日付(YYYY-MM-DD)
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

type Row = Record<string, unknown>;

export function all<T = Row>(db: DB, sql: string, ...params: unknown[]): T[] {
  return db.prepare(sql).all(...(params as never[])) as T[];
}

export function get<T = Row>(db: DB, sql: string, ...params: unknown[]): T | undefined {
  return db.prepare(sql).get(...(params as never[])) as T | undefined;
}

export function run(db: DB, sql: string, ...params: unknown[]) {
  return db.prepare(sql).run(...(params as never[]));
}
