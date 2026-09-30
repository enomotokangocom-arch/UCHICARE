/**
 * ブラウザ内デモ用: src/onboarding/server/db.ts の置き換え。
 * sql.js(SQLiteをJavaScriptで動かすライブラリ)を node:sqlite と同じ呼び出し方で使えるようにします。
 */
import type { Database, SqlValue } from "sql.js";

type Row = Record<string, unknown>;

function norm(params: unknown[]): SqlValue[] {
  return params.map((p) => (p === undefined ? null : typeof p === "boolean" ? (p ? 1 : 0) : (p as SqlValue)));
}

class Statement {
  constructor(private db: Database, private sql: string) {}
  get(...params: unknown[]): Row | undefined {
    const st = this.db.prepare(this.sql);
    try {
      st.bind(norm(params));
      return st.step() ? (st.getAsObject() as Row) : undefined;
    } finally {
      st.free();
    }
  }
  all(...params: unknown[]): Row[] {
    const st = this.db.prepare(this.sql);
    const out: Row[] = [];
    try {
      st.bind(norm(params));
      while (st.step()) out.push(st.getAsObject() as Row);
    } finally {
      st.free();
    }
    return out;
  }
  run(...params: unknown[]) {
    this.db.run(this.sql, norm(params));
    const changes = this.db.getRowsModified();
    const r = this.db.exec("SELECT last_insert_rowid()");
    return { changes, lastInsertRowid: Number(r[0]?.values[0]?.[0] ?? 0) };
  }
}

export class DB {
  constructor(public raw: Database) {}
  exec(sql: string) {
    this.raw.exec(sql);
  }
  prepare(sql: string) {
    return new Statement(this.raw, sql);
  }
  close() {
    this.raw.close();
  }
}

export function defaultDbPath() {
  return ":browser:";
}
export function openDb(): DB {
  throw new Error("ブラウザ内デモでは openDb は使いません");
}
export function getDb(): DB {
  throw new Error("ブラウザ内デモでは getDb は使いません");
}

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
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}
export function addDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function all<T = Row>(db: DB, sql: string, ...params: unknown[]): T[] {
  return db.prepare(sql).all(...params) as T[];
}
export function get<T = Row>(db: DB, sql: string, ...params: unknown[]): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined;
}
export function run(db: DB, sql: string, ...params: unknown[]) {
  return db.prepare(sql).run(...params);
}
