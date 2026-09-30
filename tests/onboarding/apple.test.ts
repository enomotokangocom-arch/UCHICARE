import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { all, get, openDb } from "../../src/onboarding/server/db";
import { approveReuse, cancelNumber, recordCreated, recordFailed, reserveNext } from "../../src/onboarding/server/apple";
import { setup, newHire, status } from "./helpers";

test("番号は037から始まり、予定メールは uchicare037@icloud.com になる", () => {
  const ctx = setup();
  const h1 = newHire(ctx, "houmon");
  const h2 = newHire(ctx, "kyotaku");
  const a = reserveNext(ctx.db, ctx.prep1, h1);
  assert.equal(a.number, 37);
  assert.equal(a.planned_email, "uchicare037@icloud.com");
  const b = reserveNext(ctx.db, ctx.prep1, h2);
  assert.equal(b.number, 38);
  assert.equal(b.planned_email, "uchicare038@icloud.com");
  const row = get<{ status: string; reserved_by: number; reserved_at: string }>(ctx.db, "SELECT * FROM apple_numbers WHERE id = ?", a.id)!;
  assert.equal(row.status, "reserved");
  assert.equal(row.reserved_by, ctx.prep1.id);
  assert.ok(row.reserved_at);
});

test("同じ入職者に2つ目の番号は予約できない", () => {
  const ctx = setup();
  const h = newHire(ctx, "houmon");
  reserveNext(ctx.db, ctx.prep1, h);
  assert.throws(() => reserveNext(ctx.db, ctx.prep1, h), (e) => status(e) === 409);
});

test("複数プロセスから同時に予約しても番号・メールが重複しない", async () => {
  const ctx = setup();
  const hires = Array.from({ length: 24 }, () => newHire(ctx, "houmon"));
  ctx.db.close();
  const workers = 4;
  const startAt = Date.now() + 1500;
  const worker = path.join(__dirname, "reserveWorker.ts");
  const runs = Array.from({ length: workers }, (_, w) => {
    const mine = hires.filter((_, i) => i % workers === w);
    return new Promise<number[]>((resolve, reject) => {
      const p = spawn(process.execPath, ["--import", "tsx", worker, ctx.dbPath, String(ctx.admin.id), String(startAt), ...mine.map(String)], {
        stdio: ["ignore", "pipe", "pipe"],
      });
      let out = "";
      let err = "";
      p.stdout.on("data", (d) => (out += d));
      p.stderr.on("data", (d) => (err += d));
      p.on("close", (code) => (code === 0 ? resolve(JSON.parse(out)) : reject(new Error(err))));
    });
  });
  const results = (await Promise.all(runs)).flat();
  assert.equal(results.length, 24);
  assert.equal(new Set(results).size, 24, "番号が重複した");
  assert.deepEqual([...results].sort((a, b) => a - b), Array.from({ length: 24 }, (_, i) => 37 + i));
  const db = openDb(ctx.dbPath);
  const emails = all<{ planned_email: string }>(db, "SELECT planned_email FROM apple_numbers").map((r) => r.planned_email);
  assert.equal(new Set(emails).size, 24);
});

test("取消した番号は自動では再利用されず、管理者の承認でのみ再利用できる", () => {
  const ctx = setup();
  const h1 = newHire(ctx, "houmon");
  const h2 = newHire(ctx, "houmon");
  const h3 = newHire(ctx, "houmon");
  const a = reserveNext(ctx.db, ctx.prep1, h1);
  cancelNumber(ctx.db, ctx.prep1, a.id, "入職辞退");
  // 次の予約は038(037は飛ばす)
  assert.equal(reserveNext(ctx.db, ctx.prep1, h2).number, 38);
  // 準備担当者は再利用を承認できない
  assert.throws(() => approveReuse(ctx.db, ctx.prep1, a.id, h3, "未作成を確認"), (e) => status(e) === 403);
  // 理由なしは不可
  assert.throws(() => approveReuse(ctx.db, ctx.admin, a.id, h3, ""), (e) => status(e) === 400);
  const r = approveReuse(ctx.db, ctx.admin, a.id, h3, "Apple側で未作成であることを確認");
  assert.equal(r.number, 37);
  const row = get<{ status: string; hire_id: number; reuse_approved_by: number }>(ctx.db, "SELECT * FROM apple_numbers WHERE id = ?", a.id)!;
  assert.equal(row.status, "reserved");
  assert.equal(row.hire_id, h3);
  assert.equal(row.reuse_approved_by, ctx.admin.id);
});

test("Apple側で作成できなかった場合は理由を記録し、使用不可の番号は再利用できない", () => {
  const ctx = setup();
  const h1 = newHire(ctx, "houmon");
  const h2 = newHire(ctx, "houmon");
  const a = reserveNext(ctx.db, ctx.prep1, h1);
  assert.throws(() => recordFailed(ctx.db, ctx.prep1, a.id, ""), (e) => status(e) === 400);
  recordFailed(ctx.db, ctx.prep1, a.id, "Apple側で既に使用されているアドレスと表示された");
  const row = get<{ status: string; failure_reason: string }>(ctx.db, "SELECT * FROM apple_numbers WHERE id = ?", a.id)!;
  assert.equal(row.status, "unusable");
  assert.match(row.failure_reason, /既に使用/);
  assert.throws(() => approveReuse(ctx.db, ctx.admin, a.id, h2, "再利用"), (e) => status(e) === 409);
  // 入職者は次の番号を予約できる
  assert.equal(reserveNext(ctx.db, ctx.prep1, h1).number, 38);
});

test("実際に作成したメールアドレスの重複を防止する", () => {
  const ctx = setup();
  const h1 = newHire(ctx, "houmon");
  const h2 = newHire(ctx, "houmon");
  const a = reserveNext(ctx.db, ctx.prep1, h1);
  const b = reserveNext(ctx.db, ctx.prep1, h2);
  recordCreated(ctx.db, ctx.prep1, a.id, "uchicare037@icloud.com");
  // 他の番号の予定メールと同じアドレスは登録できない
  assert.throws(() => recordCreated(ctx.db, ctx.prep1, b.id, "uchicare037@icloud.com", "誤入力"), (e) => status(e) === 409);
  // 予定と異なるアドレスは理由が必要
  assert.throws(() => recordCreated(ctx.db, ctx.prep1, b.id, "other038@icloud.com"), (e) => status(e) === 400);
  recordCreated(ctx.db, ctx.prep1, b.id, "uchicare038@icloud.com");
  const rows = all<{ status: string }>(ctx.db, "SELECT status FROM apple_numbers");
  assert.ok(rows.every((r) => r.status === "created"));
});

test("発行済みの最新番号の設定を変えると、その次から採番される", () => {
  const ctx = setup();
  ctx.db.prepare("UPDATE settings SET value = '40' WHERE key = 'apple_last_issued'").run();
  const h = newHire(ctx, "houmon");
  assert.equal(reserveNext(ctx.db, ctx.prep1, h).number, 41);
});
