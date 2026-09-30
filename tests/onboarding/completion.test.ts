import { test } from "node:test";
import assert from "node:assert/strict";
import { all, get } from "../../src/onboarding/server/db";
import { confirmHire, getHireDetail, markReady, recordLending, computeProgress } from "../../src/onboarding/server/hires";
import { setDeviceCheck, updateTaskStatus } from "../../src/onboarding/server/tasks";
import { recordCreated, reserveNext } from "../../src/onboarding/server/apple";
import { addCredentialRef, buildRequestText, recordIssued, recordRequested, updateHireService } from "../../src/onboarding/server/requests";
import { createDevice } from "../../src/onboarding/server/devices";
import { saveService } from "../../src/onboarding/server/admin";
import { Ctx, setup, newHire, taskId, status } from "./helpers";

const done = (ctx: Ctx, hireId: number, code: string, actor = ctx.prep1) => updateTaskStatus(ctx.db, actor, taskId(ctx, hireId, code), { status: "done" });
const checkBoth = (ctx: Ctx, hireId: number, code: string) => {
  setDeviceCheck(ctx.db, ctx.prep1, taskId(ctx, hireId, code), "iphone", true);
  setDeviceCheck(ctx.db, ctx.prep1, taskId(ctx, hireId, code), "ipad", true);
};

test("メール確定前は、メールが必要な発行依頼を確定できない(依頼文の作成は下書きとして可能)", () => {
  const ctx = setup();
  const h = newHire(ctx, "houmon");
  const zest = get<{ id: number }>(ctx.db, "SELECT ar.id FROM account_requests ar JOIN services s ON s.id = ar.service_id WHERE ar.hire_id = ? AND s.code = 'zest'", h)!.id;
  const draft = buildRequestText(ctx.db, ctx.prep1, h, [zest]);
  assert.ok(draft.warnings.length > 0);
  assert.match(draft.text, /メールアドレス: \(未確定\)/);
  // 依頼文を作成しただけでは状態は変わらない
  assert.equal(get<{ status: string }>(ctx.db, "SELECT status FROM account_requests WHERE id = ?", zest)!.status, "not_requested");
  assert.throws(() => recordRequested(ctx.db, ctx.prep1, h, { request_ids: [zest], requested_to: "責任者" }), (e) => status(e) === 409);

  const a = reserveNext(ctx.db, ctx.prep1, h);
  // 予約しただけ(Apple側未作成)ではまだ確定できない
  assert.throws(() => recordRequested(ctx.db, ctx.prep1, h, { request_ids: [zest], requested_to: "責任者" }), (e) => status(e) === 409);
  recordCreated(ctx.db, ctx.prep1, a.id, a.planned_email);
  const text = buildRequestText(ctx.db, ctx.prep1, h, [zest]);
  assert.equal(text.warnings.length, 0);
  assert.match(text.text, /uchicare037@icloud\.com/);
  assert.match(text.text, /Taro Test/);
  recordRequested(ctx.db, ctx.prep1, h, { request_ids: [zest], requested_to: "責任者", request_method: "LINE WORKS" });
  assert.equal(get<{ status: string }>(ctx.db, "SELECT status FROM account_requests WHERE id = ?", zest)!.status, "requested");
});

test("発行済みとログイン確認済みを区別し、iPhone・iPadを別々に確認する", () => {
  const ctx = setup();
  const h = newHire(ctx, "houmon");
  const a = reserveNext(ctx.db, ctx.prep1, h);
  recordCreated(ctx.db, ctx.prep1, a.id, a.planned_email);
  const req = get<{ id: number; service_id: number }>(ctx.db, "SELECT ar.id, ar.service_id FROM account_requests ar JOIN services s ON s.id = ar.service_id WHERE ar.hire_id = ? AND s.code = 'lineworks'", h)!;
  const hs = get<{ id: number }>(ctx.db, "SELECT id FROM hire_services WHERE hire_id = ? AND service_id = ?", h, req.service_id)!.id;
  // 発行前はログイン確認を記録できない
  assert.throws(() => updateHireService(ctx.db, ctx.prep1, hs, { iphone_login: true }), (e) => status(e) === 409);
  // 依頼前は発行済みにできない
  assert.throws(() => recordIssued(ctx.db, ctx.jimu, req.id, { issued_login_id: "taro.test" }), (e) => status(e) === 409);
  recordRequested(ctx.db, ctx.prep1, h, { request_ids: [req.id], requested_to: "事務" });
  recordIssued(ctx.db, ctx.jimu, req.id, { issued_login_id: "taro.test" });
  assert.equal(get<{ status: string }>(ctx.db, "SELECT status FROM account_requests WHERE id = ?", req.id)!.status, "issued");
  updateHireService(ctx.db, ctx.prep1, hs, { iphone_login: true });
  // iPhoneだけではログイン確認済みにならない
  assert.equal(get<{ status: string }>(ctx.db, "SELECT status FROM account_requests WHERE id = ?", req.id)!.status, "issued");
  updateHireService(ctx.db, ctx.prep1, hs, { ipad_login: true });
  const r = get<{ status: string; login_confirmed_at: string }>(ctx.db, "SELECT * FROM account_requests WHERE id = ?", req.id)!;
  assert.equal(r.status, "login_confirmed");
  assert.ok(r.login_confirmed_at);
});

test("作業の完了条件: 前提作業・端末ごとの確認・記録が揃わないと完了にできない", () => {
  const ctx = setup();
  const h = newHire(ctx, "houmon");
  // 前提(入社情報の確認)が未完了
  assert.throws(() => done(ctx, h, "device_secure"), (e) => status(e) === 409);
  done(ctx, h, "hire_info");
  // iPhone・iPadの確認がない
  assert.throws(() => done(ctx, h, "device_secure"), (e) => status(e) === 409 && /iPhone/.test((e as Error).message));
  setDeviceCheck(ctx.db, ctx.prep1, taskId(ctx, h, "device_secure"), "iphone", true);
  assert.throws(() => done(ctx, h, "device_secure"), (e) => /iPad/.test((e as Error).message));
  setDeviceCheck(ctx.db, ctx.prep1, taskId(ctx, h, "device_secure"), "ipad", true);
  done(ctx, h, "device_secure");
  // 番号予約していないと予約作業は完了できない
  assert.throws(() => done(ctx, h, "apple_reserve"), (e) => status(e) === 409);
});

test("対象外にするには理由が必要", () => {
  const ctx = setup();
  const h = newHire(ctx, "houmon");
  assert.throws(() => updateTaskStatus(ctx.db, ctx.prep1, taskId(ctx, h, "hire_info"), { status: "na" }), (e) => status(e) === 400);
  updateTaskStatus(ctx.db, ctx.prep1, taskId(ctx, h, "hire_info"), { status: "na", na_reason: "採用担当が確認済み" });
  assert.equal(get<{ na_reason: string }>(ctx.db, "SELECT na_reason FROM hire_tasks WHERE id = ?", taskId(ctx, h, "hire_info"))!.na_reason, "採用担当が確認済み");
});

test("必須作業に未完了があると準備完了にできない", () => {
  const ctx = setup();
  const h = newHire(ctx, "houmon");
  assert.throws(() => markReady(ctx.db, ctx.prep1, h), (e) => status(e) === 409 && /必須作業/.test((e as Error).message));
  assert.equal(get<{ status: string }>(ctx.db, "SELECT status FROM hires WHERE id = ?", h)!.status, "preparing");
});

test("任意作業は必須の完了率に含めない", () => {
  const p = computeProgress([
    { requirement: "required", status: "done", due_date: null },
    { requirement: "required", status: "todo", due_date: null },
    { requirement: "required", status: "na", due_date: null },
    { requirement: "optional", status: "todo", due_date: null },
    { requirement: "optional", status: "todo", due_date: null },
  ]);
  assert.equal(p.required_total, 2);
  assert.equal(p.required_rate, 50);
  assert.equal(p.optional_total, 2);
});

test("一連の流れ: 全必須作業の完了 → 準備完了 → 管理者確認 → 貸与", () => {
  const ctx = setup();
  // 管理者が既存端末を見てサービスの配置方式を確定する
  for (const s of all<{ id: number }>(ctx.db, "SELECT id FROM services")) {
    saveService(ctx.db, ctx.admin, s.id, { placement: "app", app_store_url: "https://apps.apple.com/jp/app/id000000", placement_confirmed: 1 });
  }
  const h = newHire(ctx, "kyotaku");
  done(ctx, h, "hire_info");
  checkBoth(ctx, h, "device_secure");
  done(ctx, h, "device_secure");
  createDevice(ctx.db, ctx.prep1, { asset_no: "T-IP-1", kind: "iPhone", serial: "S1", hire_id: h, auth_code_destination: "iPhone本体", auth_manager_id: ctx.admin.id });
  createDevice(ctx.db, ctx.prep1, { asset_no: "T-PAD-1", kind: "iPad", serial: "S2", hire_id: h, auth_code_destination: "iPhone本体", auth_manager_id: ctx.admin.id });
  checkBoth(ctx, h, "device_register");
  done(ctx, h, "device_register");
  const a = reserveNext(ctx.db, ctx.prep1, h);
  done(ctx, h, "apple_reserve");
  recordCreated(ctx.db, ctx.prep1, a.id, a.planned_email);
  done(ctx, h, "apple_create");
  // 同一職員のiPhone・iPadに同じApple Accountが初期値で割り当たる
  const devApple = all<{ apple_number_id: number }>(ctx.db, "SELECT apple_number_id FROM devices WHERE hire_id = ?", h);
  assert.ok(devApple.every((d) => d.apple_number_id === a.id));
  assert.throws(() => done(ctx, h, "recovery_record"), (e) => /参照先/.test((e as Error).message));
  addCredentialRef(ctx.db, ctx.prep1, h, { label: "Apple Account 復旧キー", ref_location: "認証情報管理ツール 保管庫「入職者」" });
  done(ctx, h, "recovery_record");

  const reqs = all<{ id: number; service_id: number; issuer_user_id: number }>(
    ctx.db, "SELECT ar.id, ar.service_id, s.issuer_user_id FROM account_requests ar JOIN services s ON s.id = ar.service_id WHERE ar.hire_id = ?", h,
  );
  recordRequested(ctx.db, ctx.prep1, h, { request_ids: reqs.map((r) => r.id), requested_to: "各発行担当" });
  done(ctx, h, "issue_request");
  for (const r of reqs) recordIssued(ctx.db, ctx.admin, r.id, { issued_login_id: `id-${r.id}` });

  checkBoth(ctx, h, "device_setup");
  done(ctx, h, "device_setup");
  // 利用要否の確認(管理者)
  for (const hs of all<{ id: number }>(ctx.db, "SELECT id FROM hire_services WHERE hire_id = ? AND requirement = 'confirm'", h)) {
    assert.throws(() => updateHireService(ctx.db, ctx.prep1, hs.id, { usage_decision: "not_use" }), (e) => status(e) === 403);
    updateHireService(ctx.db, ctx.admin, hs.id, { usage_decision: "not_use" });
  }
  const hsRows = all<{ id: number }>(ctx.db, "SELECT id FROM hire_services WHERE hire_id = ? AND requirement = 'required'", h);
  checkBoth(ctx, h, "app_placement");
  assert.throws(() => done(ctx, h, "app_placement"), (e) => /配置されていません/.test((e as Error).message));
  for (const hs of hsRows) updateHireService(ctx.db, ctx.prep1, hs.id, { iphone_placed: true, ipad_placed: true });
  done(ctx, h, "app_placement");
  checkBoth(ctx, h, "service_login");
  for (const hs of hsRows) updateHireService(ctx.db, ctx.prep1, hs.id, { iphone_login: true, ipad_login: true });
  done(ctx, h, "service_login");
  checkBoth(ctx, h, "service_verify");
  for (const hs of hsRows) updateHireService(ctx.db, ctx.prep1, hs.id, { verified: true });
  done(ctx, h, "service_verify");
  done(ctx, h, "open_items");

  // 管理者確認と貸与は手動で完了にできない
  assert.throws(() => done(ctx, h, "admin_confirm", ctx.admin), (e) => status(e) === 409);
  // 準備完了前は管理者確認できない
  assert.throws(() => confirmHire(ctx.db, ctx.admin, h, "確認"), (e) => status(e) === 409);
  markReady(ctx.db, ctx.prep1, h);
  // 準備担当者は管理者確認できない
  assert.throws(() => confirmHire(ctx.db, ctx.prep1, h, "確認"), (e) => status(e) === 403);
  // 確認前は貸与できない
  assert.throws(() => recordLending(ctx.db, ctx.prep1, h, { lent_date: "2026-11-01", explanation_note: "説明" }), (e) => status(e) === 409);
  confirmHire(ctx.db, ctx.admin, h, "iPhone・iPadで主要サービスの起動とログインを確認");
  recordLending(ctx.db, ctx.prep1, h, { lent_date: "2026-11-01", explanation_note: "画面ロック解除・主要アプリの場所・連絡先を説明" });

  const detail = getHireDetail(ctx.db, ctx.admin, h);
  assert.equal(detail.hire.status, "lent");
  assert.equal(detail.progress.required_rate, 100);
  assert.ok(all<{ lend_status: string }>(ctx.db, "SELECT lend_status FROM devices WHERE hire_id = ?", h).every((d) => d.lend_status === "lent"));
});

test("準備完了後に必須作業を未完了に戻すと、入職者は準備中に戻る", () => {
  const ctx = setup();
  const h = newHire(ctx, "houmon");
  // 管理者がすべての手動必須作業を対象外にして準備完了にする(理由付き)
  for (const t of all<{ id: number }>(ctx.db, "SELECT id FROM hire_tasks WHERE hire_id = ? AND completion_mode = 'manual'", h)) {
    updateTaskStatus(ctx.db, ctx.admin, t.id, { status: "na", na_reason: "テスト" });
  }
  for (const hs of all<{ id: number }>(ctx.db, "SELECT id FROM hire_services WHERE hire_id = ? AND requirement = 'confirm'", h)) {
    updateHireService(ctx.db, ctx.admin, hs.id, { usage_decision: "not_use" });
  }
  markReady(ctx.db, ctx.prep1, h);
  updateTaskStatus(ctx.db, ctx.prep1, taskId(ctx, h, "hire_info"), { status: "doing" });
  assert.equal(get<{ status: string }>(ctx.db, "SELECT status FROM hires WHERE id = ?", h)!.status, "preparing");
});
