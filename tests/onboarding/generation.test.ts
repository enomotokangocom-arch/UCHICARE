import { test } from "node:test";
import assert from "node:assert/strict";
import { all, get } from "../../src/onboarding/server/db";
import { setup, newHire } from "./helpers";

function servicesOf(ctx: ReturnType<typeof setup>, hireId: number) {
  return all<{ code: string; requirement: string; usage_decision: string | null }>(
    ctx.db, "SELECT s.code, hs.requirement, hs.usage_decision FROM hire_services hs JOIN services s ON s.id = hs.service_id WHERE hs.hire_id = ?", hireId,
  );
}
function requestCodes(ctx: ReturnType<typeof setup>, hireId: number) {
  return all<{ code: string }>(ctx.db, "SELECT s.code FROM account_requests ar JOIN services s ON s.id = ar.service_id WHERE ar.hire_id = ?", hireId).map((r) => r.code);
}

test("訪問看護の入職者には iBOW を含むサービス作業・発行依頼が生成される", () => {
  const ctx = setup();
  const h = newHire(ctx, "houmon");
  const codes = servicesOf(ctx, h).map((s) => s.code);
  assert.ok(codes.includes("ibow"));
  assert.ok(requestCodes(ctx, h).includes("ibow"));
  for (const c of ["efax", "mybridge", "zoom", "casio_dm2", "mcs", "chatgpt", "zest", "lineworks", "enursing", "gsheets", "gmaps", "company_hp"]) {
    assert.ok(codes.includes(c), `${c} が生成されていない`);
  }
});

test("居宅介護支援の入職者には iBOW が生成されない", () => {
  const ctx = setup();
  const h = newHire(ctx, "kyotaku");
  assert.ok(!servicesOf(ctx, h).some((s) => s.code === "ibow"));
  assert.ok(!requestCodes(ctx, h).includes("ibow"));
});

test("どちらの部門にも ZEST・eNursing・SQE eラーニングの発行依頼が生成される", () => {
  const ctx = setup();
  for (const dept of ["houmon", "kyotaku"] as const) {
    const h = newHire(ctx, dept);
    const reqs = requestCodes(ctx, h);
    assert.ok(reqs.includes("zest"), `${dept}: ZEST`);
    assert.ok(reqs.includes("enursing"), `${dept}: eNursing`);
    assert.ok(reqs.includes("sqe_elearning"), `${dept}: SQE eラーニング`);
  }
});

test("SQE eラーニングの登録は榎本対応として表示される", async () => {
  const { dashboard } = await import("../../src/onboarding/server/hires");
  const ctx = setup();
  newHire(ctx, "houmon");
  const titles = dashboard(ctx.db, ctx.admin).enomotoTasks.map((t) => String(t.title));
  assert.ok(titles.some((t) => t.includes("SQE eラーニング")));
});

test("既存のデータベースにも後から追加した標準サービスが追加される", async () => {
  const { seedMaster } = await import("../../src/onboarding/server/seed");
  const { openDb } = await import("../../src/onboarding/server/db");
  const ctx = setup();
  // 追加前の状態を再現
  ctx.db.exec("DELETE FROM department_services WHERE service_id = (SELECT id FROM services WHERE code = 'sqe_elearning'); DELETE FROM services WHERE code = 'sqe_elearning';");
  ctx.db.close();
  const db = openDb(ctx.dbPath);
  seedMaster(db);
  const s = get<{ id: number; owner_mode: string }>(db, "SELECT id, owner_mode FROM services WHERE code = 'sqe_elearning'")!;
  assert.equal(s.owner_mode, "enomoto");
  assert.equal(all(db, "SELECT * FROM department_services WHERE service_id = ? AND requirement = 'required'", s.id).length, 2);
});

test("標準チェックリスト14項目が順番どおりに生成され、配置方式未確定の確認作業も追加される", () => {
  const ctx = setup();
  const h = newHire(ctx, "houmon");
  const titles = all<{ title: string; template_code: string }>(ctx.db, "SELECT title, template_code FROM hire_tasks WHERE hire_id = ? ORDER BY sort_no", h);
  const standard = titles.filter((t) => t.template_code !== "confirm_placement").map((t) => t.title);
  assert.deepEqual(standard, [
    "入社情報を確認する", "iPhone・iPadを確保する", "端末を台帳に登録する", "Appleアカウントの番号を予約する",
    "Apple AccountとiCloudメールを作成する", "認証コード受信先と復旧情報を記録する", "確定したメールアドレスで各サービスの発行を依頼する",
    "iPhone・iPadの設定アプリで初期設定する", "アプリのインストールとWebのホーム画面保存を行う", "各サービスへログインする",
    "本人名、所属、権限、通知、必要機能を確認する", "未完了項目の担当者と期限を記録する", "管理者が準備完了を確認する", "職員へ貸与し、操作説明を記録する",
  ]);
  assert.ok(titles.some((t) => t.template_code === "confirm_placement"));
});

test("すべてのサービスの配置方式が確定済みなら、確認作業は生成されない", () => {
  const ctx = setup();
  ctx.db.exec("UPDATE services SET placement = 'app', placement_confirmed = 1");
  const h = newHire(ctx, "kyotaku");
  assert.equal(get(ctx.db, "SELECT 1 FROM hire_tasks WHERE hire_id = ? AND template_code = 'confirm_placement'", h), undefined);
});

test("KING of 勤怠・Notion は「利用要否の確認」として生成され、発行依頼は作られない", () => {
  const ctx = setup();
  const h = newHire(ctx, "kyotaku");
  const svc = servicesOf(ctx, h);
  for (const c of ["king_of_time", "notion"]) {
    const s = svc.find((x) => x.code === c)!;
    assert.equal(s.requirement, "confirm");
    assert.equal(s.usage_decision, "pending");
  }
  assert.ok(!requestCodes(ctx, h).includes("king_of_time"));
});

test("作業には担当者と期限(入社日基準)が設定される", () => {
  const ctx = setup();
  const h = newHire(ctx, "houmon");
  const t = get<{ assignee_id: number; due_date: string }>(ctx.db, "SELECT assignee_id, due_date FROM hire_tasks WHERE hire_id = ? AND template_code = 'hire_info'", h)!;
  assert.equal(t.assignee_id, ctx.prep1.id);
  assert.equal(t.due_date, "2026-10-11"); // 入社日 2026-11-01 の21日前
  const c = get<{ assignee_id: number }>(ctx.db, "SELECT assignee_id FROM hire_tasks WHERE hire_id = ? AND template_code = 'admin_confirm'", h)!;
  assert.equal(c.assignee_id, ctx.admin.id);
});
