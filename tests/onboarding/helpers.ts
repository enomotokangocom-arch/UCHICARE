import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DB, get, openDb } from "../../src/onboarding/server/db";
import { Actor, loadActor } from "../../src/onboarding/server/core";
import { createUserRow, seedMaster } from "../../src/onboarding/server/seed";
import { createHire } from "../../src/onboarding/server/hires";

export function tmpDbPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "onboarding-test-"));
  return path.join(dir, "test.db");
}

export interface Ctx {
  db: DB; dbPath: string;
  admin: Actor; enomoto: Actor; prep1: Actor; prep2: Actor; jimu: Actor; sekinin: Actor; viewer: Actor;
  houmon: number; kyotaku: number; officeA: number; officeB: number;
}

export function setup(): Ctx {
  const dbPath = tmpDbPath();
  const db = openDb(dbPath);
  seedMaster(db);
  const houmon = get<{ id: number }>(db, "SELECT id FROM departments WHERE code='houmon'")!.id;
  const kyotaku = get<{ id: number }>(db, "SELECT id FROM departments WHERE code='kyotaku'")!.id;
  const officeA = Number(db.prepare("INSERT INTO offices (name, department_id) VALUES ('テスト事業所A', ?)").run(houmon).lastInsertRowid);
  const officeB = Number(db.prepare("INSERT INTO offices (name, department_id) VALUES ('テスト事業所B', ?)").run(kyotaku).lastInsertRowid);
  const mk = (login_id: string, role: string, extra: object = {}) =>
    loadActor(db, createUserRow(db, { login_id, name: login_id, role, password: "test-password", ...extra }))!;
  const ctx: Ctx = {
    db, dbPath, houmon, kyotaku, officeA, officeB,
    admin: mk("admin", "admin"),
    enomoto: mk("enomoto", "admin", { is_representative: true }),
    prep1: mk("prep1", "preparer"),
    prep2: mk("prep2", "preparer"),
    jimu: mk("jimu", "issuer"),
    sekinin: mk("sekinin", "issuer"),
    viewer: mk("viewer", "viewer", { scope_office_ids: [officeA] }),
  };
  db.prepare("UPDATE services SET issuer_user_id = ? WHERE code IN ('ibow','lineworks')").run(ctx.jimu.id);
  db.prepare("UPDATE services SET issuer_user_id = ? WHERE code = 'zest'").run(ctx.sekinin.id);
  db.prepare("UPDATE services SET issuer_user_id = ? WHERE code = 'enursing'").run(ctx.enomoto.id);
  return ctx;
}

export function newHire(ctx: Ctx, dept: "houmon" | "kyotaku", extra: Record<string, unknown> = {}) {
  return createHire(ctx.db, ctx.admin, {
    name: "テスト 太郎", name_romaji: "Taro Test",
    department_id: dept === "houmon" ? ctx.houmon : ctx.kyotaku,
    office_id: dept === "houmon" ? ctx.officeA : ctx.officeB,
    start_date: "2026-11-01", preparer_id: ctx.prep1.id, checker_id: ctx.admin.id, ...extra,
  });
}

export function taskId(ctx: Ctx, hireId: number, code: string): number {
  return get<{ id: number }>(ctx.db, "SELECT id FROM hire_tasks WHERE hire_id = ? AND template_code = ?", hireId, code)!.id;
}

export function status(err: unknown): number | undefined {
  return (err as { status?: number }).status;
}
