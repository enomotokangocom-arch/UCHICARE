import { test } from "node:test";
import assert from "node:assert/strict";
import { get } from "../../src/onboarding/server/db";
import { createHire, dashboard, getHireDetail, updateHire } from "../../src/onboarding/server/hires";
import { updateTaskAssignment, updateTaskStatus } from "../../src/onboarding/server/tasks";
import { reserveNext, recordCreated } from "../../src/onboarding/server/apple";
import { addCredentialRef, recordIssued, recordRequested } from "../../src/onboarding/server/requests";
import { listDevices, createDevice } from "../../src/onboarding/server/devices";
import { saveService, saveTemplate, saveUser, updateSettings, listAudit } from "../../src/onboarding/server/admin";
import { login, actorFromToken } from "../../src/onboarding/server/auth";
import { setup, newHire, taskId, status } from "./helpers";

const is403 = (e: unknown) => status(e) === 403;

test("準備担当者は担当していない入職者を閲覧・変更できない", () => {
  const ctx = setup();
  const h = newHire(ctx, "houmon"); // 準備担当 prep1
  assert.throws(() => getHireDetail(ctx.db, ctx.prep2, h), is403);
  assert.throws(() => reserveNext(ctx.db, ctx.prep2, h), is403);
  assert.throws(() => updateTaskStatus(ctx.db, ctx.prep2, taskId(ctx, h, "hire_info"), { status: "doing" }), is403);
  assert.equal(dashboard(ctx.db, ctx.prep2).hires.length, 0);
  assert.equal(dashboard(ctx.db, ctx.prep1).hires.length, 1);
});

test("閲覧者は許可された事業所のみ閲覧でき、変更はできない", () => {
  const ctx = setup();
  const hA = newHire(ctx, "houmon"); // 事業所A(閲覧許可あり)
  const hB = newHire(ctx, "kyotaku"); // 事業所B
  const d = getHireDetail(ctx.db, ctx.viewer, hA);
  assert.equal(d.credentials, null, "閲覧者に認証情報の参照先を見せない");
  assert.throws(() => getHireDetail(ctx.db, ctx.viewer, hB), is403);
  assert.throws(() => updateTaskStatus(ctx.db, ctx.viewer, taskId(ctx, hA, "hire_info"), { status: "doing" }), is403);
  assert.throws(() => reserveNext(ctx.db, ctx.viewer, hA), is403);
  assert.deepEqual(dashboard(ctx.db, ctx.viewer).hires.map((h) => h.id), [hA]);
  assert.throws(() => listDevices(ctx.db, ctx.viewer), is403);
});

test("入職者の登録・担当者の変更は管理者のみ", () => {
  const ctx = setup();
  const h = newHire(ctx, "houmon");
  assert.throws(() => createHire(ctx.db, ctx.prep1, { name: "x", name_romaji: "X", department_id: ctx.houmon, start_date: "2026-11-01" }), is403);
  assert.throws(() => updateHire(ctx.db, ctx.prep1, h, { preparer_id: ctx.prep2.id }), is403);
  assert.throws(() => updateTaskAssignment(ctx.db, ctx.prep1, taskId(ctx, h, "hire_info"), { assignee_id: ctx.prep2.id }), is403);
  // 準備担当者も期限は変更できる
  updateTaskAssignment(ctx.db, ctx.prep1, taskId(ctx, h, "hire_info"), { due_date: "2026-10-20" });
  updateHire(ctx.db, ctx.admin, h, { preparer_id: ctx.prep2.id });
  // 未完了作業の担当も引き継がれる
  assert.equal(get<{ assignee_id: number }>(ctx.db, "SELECT assignee_id FROM hire_tasks WHERE id = ?", taskId(ctx, h, "hire_info"))!.assignee_id, ctx.prep2.id);
});

test("事務・発行責任者は担当サービスの発行状況のみ更新できる", () => {
  const ctx = setup();
  const h = newHire(ctx, "houmon");
  const a = reserveNext(ctx.db, ctx.prep1, h);
  recordCreated(ctx.db, ctx.prep1, a.id, a.planned_email);
  const id = (code: string) => get<{ id: number }>(ctx.db, "SELECT ar.id FROM account_requests ar JOIN services s ON s.id = ar.service_id WHERE ar.hire_id = ? AND s.code = ?", h, code)!.id;
  recordRequested(ctx.db, ctx.prep1, h, { request_ids: [id("ibow"), id("zest")], requested_to: "事務・責任者" });
  // 事務はiBOWの発行担当なので閲覧・更新できる
  const detail = getHireDetail(ctx.db, ctx.jimu, h);
  assert.equal(detail.credentials, null, "発行担当者に認証情報の参照先を見せない");
  recordIssued(ctx.db, ctx.jimu, id("ibow"), { issued_login_id: "ibow-user" });
  // ZESTは責任者の担当なので事務は更新できない
  assert.throws(() => recordIssued(ctx.db, ctx.jimu, id("zest"), { issued_login_id: "zest-user" }), is403);
  recordIssued(ctx.db, ctx.sekinin, id("zest"), { issued_login_id: "zest-user" });
  // 発行担当者は準備作業(番号予約等)はできない
  assert.throws(() => reserveNext(ctx.db, ctx.jimu, h), is403);
  assert.throws(() => createDevice(ctx.db, ctx.jimu, { asset_no: "X", kind: "iPhone" }), is403);
});

test("管理設定は管理者のみ変更できる", () => {
  const ctx = setup();
  for (const actor of [ctx.prep1, ctx.jimu, ctx.viewer]) {
    assert.throws(() => updateSettings(ctx.db, actor, { company_wifi_name: "x" }), is403);
    assert.throws(() => saveService(ctx.db, actor, null, { name: "新サービス" }), is403);
    assert.throws(() => saveTemplate(ctx.db, actor, 1, { title: "変更" }), is403);
    assert.throws(() => saveUser(ctx.db, actor, null, { name: "a", login_id: "aaa", role: "admin", password: "12345678" }), is403);
    assert.throws(() => listAudit(ctx.db, actor, {}), is403);
  }
});

test("認証情報の参照先は管理者と担当の準備担当者のみ閲覧でき、実際のパスワードらしき入力は拒否される", () => {
  const ctx = setup();
  const h = newHire(ctx, "houmon");
  assert.throws(() => addCredentialRef(ctx.db, ctx.prep1, h, { label: "Apple", ref_location: "PW: abc12345" }), (e) => status(e) === 400);
  assert.throws(() => addCredentialRef(ctx.db, ctx.prep1, h, { label: "端末", ref_location: "パスコード=123456" }), (e) => status(e) === 400);
  addCredentialRef(ctx.db, ctx.prep1, h, { label: "Apple Account", ref_location: "1Password: 保管庫「入職者」> 項目 Apple" });
  assert.equal(getHireDetail(ctx.db, ctx.prep1, h).credentials!.length, 1);
  assert.equal(getHireDetail(ctx.db, ctx.admin, h).credentials!.length, 1);
  // 確認管理者でない他の準備担当者は閲覧自体できない
  assert.throws(() => getHireDetail(ctx.db, ctx.prep2, h), is403);
  // 端末パスコードの参照先も同様
  createDevice(ctx.db, ctx.prep1, { asset_no: "P-1", kind: "iPhone", hire_id: h, passcode_ref: "保管庫「端末」" });
  createDevice(ctx.db, ctx.admin, { asset_no: "P-2", kind: "iPad", passcode_ref: "保管庫「在庫端末」" });
  const forPrep2 = listDevices(ctx.db, ctx.prep2);
  assert.ok(forPrep2.every((d) => !("passcode_ref" in d)));
  const forPrep1 = listDevices(ctx.db, ctx.prep1);
  assert.ok(forPrep1.find((d) => d.asset_no === "P-1")!.passcode_ref);
});

test("ログイン: 誤ったパスワード・無効ユーザーは拒否され、セッションから利用者を特定できる", () => {
  const ctx = setup();
  assert.throws(() => login(ctx.db, "prep1", "wrong-password"), (e) => status(e) === 401);
  const { token } = login(ctx.db, "prep1", "test-password");
  assert.equal(actorFromToken(ctx.db, token)!.id, ctx.prep1.id);
  assert.equal(actorFromToken(ctx.db, "invalid"), null);
  saveUser(ctx.db, ctx.admin, ctx.prep1.id, { name: "prep1", login_id: "prep1", role: "preparer", active: 0 });
  assert.equal(actorFromToken(ctx.db, token), null, "無効化されたユーザーのセッションは使えない");
  assert.throws(() => login(ctx.db, "prep1", "test-password"), (e) => status(e) === 401);
});
