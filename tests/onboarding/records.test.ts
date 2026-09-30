import { test } from "node:test";
import assert from "node:assert/strict";
import { all, get, openDb } from "../../src/onboarding/server/db";
import { getHireDetail, updateHire } from "../../src/onboarding/server/hires";
import { updateTaskStatus } from "../../src/onboarding/server/tasks";
import { reserveNext } from "../../src/onboarding/server/apple";
import { addCredentialRef, buildRequestText } from "../../src/onboarding/server/requests";
import { createDevice } from "../../src/onboarding/server/devices";
import { applyTemplate, getManual, previewTemplateApply, saveService, saveTemplate } from "../../src/onboarding/server/admin";
import { progressCsv } from "../../src/onboarding/server/exports";
import { loadActor } from "../../src/onboarding/server/core";
import { lineDiff } from "../../src/onboarding/shared/diff";
import { setup, newHire, taskId } from "./helpers";

test("担当者変更の履歴(変更者・内容・日時)が残る", () => {
  const ctx = setup();
  const h = newHire(ctx, "houmon");
  updateHire(ctx.db, ctx.admin, h, { preparer_id: ctx.prep2.id });
  const log = get<{ user_name: string; action: string; detail: string; at: string }>(ctx.db, "SELECT * FROM audit_logs WHERE hire_id = ? AND action = '担当者を変更'", h)!;
  assert.equal(log.user_name, "admin");
  assert.ok(log.at);
  const detail = JSON.parse(log.detail);
  assert.deepEqual(detail.preparer_id, { before: ctx.prep1.id, after: ctx.prep2.id });
});

test("手順変更は履歴に残り、完了済みの記録は書き換えず、進行中の作業へは差分確認後に適用する", () => {
  const ctx = setup();
  const h1 = newHire(ctx, "houmon");
  const h2 = newHire(ctx, "houmon");
  const tpl = get<{ id: number; procedure: string }>(ctx.db, "SELECT id, procedure FROM task_templates WHERE code = 'hire_info'")!;
  // h1 は完了済み
  updateTaskStatus(ctx.db, ctx.prep1, taskId(ctx, h1, "hire_info"), { status: "done" });
  const newProcedure = tpl.procedure + "\n5. 緊急連絡先を確認する";
  saveTemplate(ctx.db, ctx.admin, tpl.id, { procedure: newProcedure }, "緊急連絡先の確認を追加");

  const t = get<{ version: number; updated_by: number; updated_at: string }>(ctx.db, "SELECT * FROM task_templates WHERE id = ?", tpl.id)!;
  assert.equal(t.version, 2);
  assert.equal(t.updated_by, ctx.admin.id);
  assert.ok(get(ctx.db, "SELECT 1 FROM audit_logs WHERE entity = 'template' AND entity_id = ? AND action = '標準手順を変更'", tpl.id));
  assert.equal(all(ctx.db, "SELECT * FROM template_revisions WHERE template_id = ?", tpl.id).length, 2);

  // 自動では既存の作業は変わらない
  const p1 = get<{ procedure: string }>(ctx.db, "SELECT procedure FROM hire_tasks WHERE id = ?", taskId(ctx, h1, "hire_info"))!;
  const p2 = get<{ procedure: string }>(ctx.db, "SELECT procedure FROM hire_tasks WHERE id = ?", taskId(ctx, h2, "hire_info"))!;
  assert.equal(p1.procedure, tpl.procedure);
  assert.equal(p2.procedure, tpl.procedure);

  // 差分確認: 進行中(h2)のみ対象、完了済み(h1)は保持
  const preview = previewTemplateApply(ctx.db, ctx.admin, tpl.id);
  assert.deepEqual(preview.outdated.map((o) => o.hire_id), [h2]);
  assert.equal(preview.keptCompleted, 1);
  const added = preview.outdated[0].diffs.find((d) => d.field === "procedure")!.lines.filter((l) => l.type === "add");
  assert.deepEqual(added.map((l) => l.text), ["5. 緊急連絡先を確認する"]);

  applyTemplate(ctx.db, ctx.admin, tpl.id, { task_ids: preview.outdated.map((o) => o.task_id) });
  assert.equal(get<{ procedure: string }>(ctx.db, "SELECT procedure FROM hire_tasks WHERE id = ?", taskId(ctx, h2, "hire_info"))!.procedure, newProcedure);
  assert.equal(get<{ procedure: string }>(ctx.db, "SELECT procedure FROM hire_tasks WHERE id = ?", taskId(ctx, h1, "hire_info"))!.procedure, tpl.procedure);
  assert.ok(get(ctx.db, "SELECT 1 FROM audit_logs WHERE hire_id = ? AND action = '手順の変更を適用'", h2));
  // 完了済みの作業に適用しようとすると拒否
  assert.throws(() => applyTemplate(ctx.db, ctx.admin, tpl.id, { task_ids: [taskId(ctx, h1, "hire_info")] }));
});

test("eNursingは権限移管まで榎本対応として表示され、移管後に発行担当者を変更できる", async () => {
  const { dashboard } = await import("../../src/onboarding/server/hires");
  const ctx = setup();
  newHire(ctx, "kyotaku");
  const before = dashboard(ctx.db, ctx.admin).enomotoTasks;
  assert.ok(before.some((t) => String(t.title).includes("eNursing")));
  const svc = get<{ id: number }>(ctx.db, "SELECT id FROM services WHERE code = 'enursing'")!;
  // 担当(役割)が榎本のまま「移管済み」にはできない
  assert.throws(() => saveService(ctx.db, ctx.admin, svc.id, { owner_mode: "transferred" }));
  saveService(ctx.db, ctx.admin, svc.id, { owner_mode: "transferred", issuer_label: "事務", issuer_user_id: ctx.jimu.id });
  const after = dashboard(ctx.db, ctx.admin).enomotoTasks;
  assert.ok(!after.some((t) => String(t.title).includes("eNursing")));
  assert.ok(get(ctx.db, "SELECT 1 FROM audit_logs WHERE entity = 'service' AND entity_id = ? AND action = 'サービスの発行担当を変更'", svc.id));
});

test("データは再起動(DBの再オープン)後も保持される", () => {
  const ctx = setup();
  const h = newHire(ctx, "houmon");
  reserveNext(ctx.db, ctx.prep1, h);
  ctx.db.close();
  const db2 = openDb(ctx.dbPath);
  assert.equal(get<{ name: string }>(db2, "SELECT name FROM hires WHERE id = ?", h)!.name, "テスト 太郎");
  assert.equal(get<{ number: number }>(db2, "SELECT number FROM apple_numbers WHERE hire_id = ?", h)!.number, 37);
  assert.ok(loadActor(db2, ctx.prep1.id));
});

test("印刷用データ・CSV・依頼文・手順書・履歴に認証情報の参照先やパスワードが含まれない", () => {
  const ctx = setup();
  const SECRET_REF = "保管庫XYZ-秘密の場所";
  const h = newHire(ctx, "houmon");
  addCredentialRef(ctx.db, ctx.prep1, h, { label: "Apple Account", ref_location: SECRET_REF });
  createDevice(ctx.db, ctx.prep1, { asset_no: "C-1", kind: "iPhone", hire_id: h, passcode_ref: SECRET_REF });
  const svc = get<{ id: number }>(ctx.db, "SELECT id FROM services WHERE code = 'zest'")!;
  saveService(ctx.db, ctx.admin, svc.id, { credential_ref: SECRET_REF });

  // 通常画面(準備担当者)では見える
  assert.ok(JSON.stringify(getHireDetail(ctx.db, ctx.prep1, h)).includes(SECRET_REF));
  // 印刷用では含まれない
  const print = JSON.stringify(getHireDetail(ctx.db, ctx.prep1, h, { print: true }));
  assert.ok(!print.includes(SECRET_REF));
  // CSV
  const csv = progressCsv(ctx.db, ctx.admin);
  assert.ok(!csv.includes(SECRET_REF));
  assert.ok(!/パスワード|password|passcode/i.test(csv));
  assert.ok(csv.startsWith("﻿氏名"));
  // 部門別手順書
  const manual = JSON.stringify(getManual(ctx.db, ctx.houmon));
  assert.ok(!manual.includes(SECRET_REF));
  // 依頼文
  const zestReq = get<{ id: number }>(ctx.db, "SELECT id FROM account_requests WHERE hire_id = ? AND service_id = ?", h, svc.id)!;
  assert.ok(!buildRequestText(ctx.db, ctx.prep1, h, [zestReq.id]).text.includes(SECRET_REF));
  // 変更履歴にも参照先の内容を残さない
  const logs = all<{ detail: string | null }>(ctx.db, "SELECT detail FROM audit_logs");
  assert.ok(logs.every((l) => !(l.detail ?? "").includes(SECRET_REF)));
});

test("行差分: 追加・削除行を検出する", () => {
  const d = lineDiff("a\nb\nc", "a\nc\nd");
  assert.deepEqual(d, [
    { type: "same", text: "a" }, { type: "del", text: "b" }, { type: "same", text: "c" }, { type: "add", text: "d" },
  ]);
});
