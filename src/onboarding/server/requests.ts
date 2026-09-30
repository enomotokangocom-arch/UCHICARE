import { DB, all, get, nowIso, run, todayStr, tx } from "./db";
import { Actor, assertNoSecret, audit, badRequest, conflict, forbidden, getSetting, intOrNull, isDate, notFound, requireRole, str } from "./core";
import { assertPrepare, assertViewHire, canUpdateIssuance, loadHireRef } from "./authz";
import { addServiceRows } from "./hires";

/**
 * アカウント発行依頼。
 * - 「依頼文の作成」(buildRequestText)は文章を作るだけで、状態は変えません。
 * - 「依頼した記録」(recordRequested)で初めて依頼済みになります。
 * - メール必須のサービスは、Appleメールが確定(作成済み)するまで依頼を確定できません。
 * - 各サービスのパスワードは扱いません(別途管理者が設定)。
 */

type RequestRow = {
  id: number; hire_id: number; service_id: number; status: string; service_name: string; requires_email: number;
  issuer_label: string | null; issuer_user_id: number | null; deputy_user_id: number | null; issuer_name: string | null;
  desired_date: string | null; requested_to: string | null;
};

function loadRequests(db: DB, hireId: number, ids?: number[]): RequestRow[] {
  const rows = all<RequestRow>(
    db,
    `SELECT ar.*, s.name AS service_name, s.requires_email, s.issuer_label, s.issuer_user_id, s.deputy_user_id, u.name AS issuer_name
       FROM account_requests ar JOIN services s ON s.id = ar.service_id LEFT JOIN users u ON u.id = s.issuer_user_id
      WHERE ar.hire_id = ? ORDER BY s.sort`,
    hireId,
  );
  return ids ? rows.filter((r) => ids.includes(r.id)) : rows;
}

export function confirmedEmailOf(db: DB, hireId: number): string | null {
  return get<{ actual_email: string }>(db, "SELECT actual_email FROM apple_numbers WHERE hire_id = ? AND status = 'created'", hireId)?.actual_email ?? null;
}

function parseIds(v: unknown): number[] {
  if (!Array.isArray(v) || v.length === 0) throw badRequest("対象のサービスを選択してください。");
  return v.map((x) => {
    const n = Number(x);
    if (!Number.isInteger(n)) throw badRequest("対象の指定が正しくありません。");
    return n;
  });
}

export function buildRequestText(db: DB, actor: Actor, hireId: number, requestIds: unknown, recipient?: unknown) {
  assertPrepare(db, actor, hireId);
  const ids = parseIds(requestIds);
  const rows = loadRequests(db, hireId, ids);
  if (rows.length !== ids.length) throw notFound("発行依頼が見つかりません。");
  const email = confirmedEmailOf(db, hireId);
  const needEmail = rows.filter((r) => r.requires_email);
  const warnings: string[] = [];
  if (!email && needEmail.length) {
    warnings.push(
      `メールアドレスが未確定です。${needEmail.map((r) => r.service_name).join("・")} はメールアドレス確定後に依頼してください(この依頼文は下書きです)。`,
    );
  }
  const h = get<Record<string, string | null>>(
    db,
    `SELECT h.name, h.name_romaji, h.start_date, j.name AS job_type_name, o.name AS office_name, d.name AS department_name
       FROM hires h JOIN departments d ON d.id = h.department_id LEFT JOIN job_types j ON j.id = h.job_type_id
       LEFT JOIN offices o ON o.id = h.office_id WHERE h.id = ?`,
    hireId,
  )!;
  const to = str(recipient) ?? ([...new Set(rows.map((r) => r.issuer_name ?? r.issuer_label ?? "(発行担当 未設定)"))].join("・"));
  const desired = rows.map((r) => r.desired_date).filter(Boolean).sort()[0] ?? "(未設定)";
  const text = [
    `${to} 様`,
    "",
    "新入職員のアカウント発行をお願いします。",
    "",
    `■ 職員名: ${h.name}`,
    `■ ローマ字: ${h.name_romaji}`,
    `■ 職種: ${h.job_type_name ?? "(未設定)"}`,
    `■ 部門・所属事業所: ${h.department_name} / ${h.office_name ?? "(未設定)"}`,
    `■ 入社日: ${h.start_date}`,
    `■ メールアドレス: ${email ?? "(未確定)"}`,
    `■ 必要なサービス: ${rows.map((r) => r.service_name).join("、")}`,
    `■ 発行希望日: ${desired}`,
    `■ 依頼日: ${todayStr()}`,
    "",
    "発行後、発行したID(ログインID)をお知らせください。",
    "※ パスワードは別途管理者から設定します。このメッセージにはパスワードを記載しないでください。",
  ].join("\n");
  audit(db, actor, "依頼文を作成(未送信)", "account_request", null, hireId, { services: rows.map((r) => r.service_name), to });
  return { text, warnings, email };
}

export function recordRequested(
  db: DB, actor: Actor, hireId: number,
  input: { request_ids?: unknown; requested_to?: unknown; request_method?: unknown; requested_at?: unknown },
) {
  assertPrepare(db, actor, hireId);
  const ids = parseIds(input.request_ids);
  const to = str(input.requested_to);
  const method = str(input.request_method);
  const date = str(input.requested_at) ?? todayStr();
  if (!to) throw badRequest("依頼先を入力してください。");
  if (!isDate(date)) throw badRequest("依頼日の形式が正しくありません。");
  assertNoSecret(method, "依頼方法");
  tx(db, () => {
    const rows = loadRequests(db, hireId, ids);
    if (rows.length !== ids.length) throw notFound("発行依頼が見つかりません。");
    const email = confirmedEmailOf(db, hireId);
    const blocked = rows.filter((r) => r.requires_email && !email);
    if (blocked.length) {
      throw conflict(
        `メールアドレスが確定していないため、${blocked.map((r) => r.service_name).join("・")} の発行依頼を確定できません。先にAppleアカウントを「作成済み」にしてください。`,
      );
    }
    for (const r of rows) {
      if (r.status !== "not_requested") throw conflict(`「${r.service_name}」は既に依頼済みです。`);
      run(
        db,
        "UPDATE account_requests SET status = 'requested', requested_to = ?, request_method = ?, requested_at = ?, requested_by = ? WHERE id = ?",
        to, method, date, actor.id, r.id,
      );
    }
    audit(db, actor, "発行を依頼した記録", "account_request", null, hireId, { services: rows.map((r) => r.service_name), to, method, date, email });
  });
}

function loadRequest(db: DB, id: number): RequestRow {
  const r = get<RequestRow>(
    db,
    `SELECT ar.*, s.name AS service_name, s.requires_email, s.issuer_label, s.issuer_user_id, s.deputy_user_id, NULL AS issuer_name
       FROM account_requests ar JOIN services s ON s.id = ar.service_id WHERE ar.id = ?`,
    id,
  );
  if (!r) throw notFound("発行依頼が見つかりません。");
  return r;
}

/** 発行済みの記録(発行担当者・代行担当者・準備担当者・管理者) */
export function recordIssued(db: DB, actor: Actor, requestId: number, input: { issued_at?: unknown; issued_login_id?: unknown }) {
  const r = loadRequest(db, requestId);
  const hire = assertViewHire(db, actor, r.hire_id);
  if (!canUpdateIssuance(actor, hire, r)) throw forbidden("このサービスの発行状況を更新する権限がありません。");
  const date = str(input.issued_at) ?? todayStr();
  const loginId = str(input.issued_login_id);
  if (!isDate(date)) throw badRequest("発行完了日の形式が正しくありません。");
  if (!loginId) throw badRequest("発行されたID(ログインID)を入力してください。パスワードは入力しないでください。");
  assertNoSecret(loginId, "発行されたID");
  tx(db, () => {
    const cur = loadRequest(db, requestId);
    if (cur.status !== "requested") throw conflict("「依頼済み」のサービスのみ発行済みにできます。先に依頼した記録をつけてください。");
    run(db, "UPDATE account_requests SET status = 'issued', issued_at = ?, issued_by = ?, issued_login_id = ? WHERE id = ?", date, actor.id, loginId, requestId);
    audit(db, actor, "発行済みを記録", "account_request", requestId, cur.hire_id, { service: cur.service_name, issued_at: date, issued_login_id: loginId });
  });
}

export function updateRequest(db: DB, actor: Actor, requestId: number, input: { desired_date?: unknown; note?: unknown; status?: unknown }) {
  const r = loadRequest(db, requestId);
  assertPrepare(db, actor, r.hire_id);
  const desired = input.desired_date !== undefined ? str(input.desired_date) : r.desired_date;
  if (desired !== null && !isDate(desired)) throw badRequest("発行希望日の形式が正しくありません。");
  const note = input.note !== undefined ? str(input.note) : undefined;
  assertNoSecret(note, "備考");
  tx(db, () => {
    run(db, "UPDATE account_requests SET desired_date = ?, note = COALESCE(?, note) WHERE id = ?", desired, note ?? null, requestId);
    if (input.status === "cancelled") {
      if (actor.role !== "admin") throw forbidden("発行依頼の取消は管理者のみ行えます。");
      run(db, "UPDATE account_requests SET status = 'cancelled' WHERE id = ?", requestId);
    }
    audit(db, actor, "発行依頼を更新", "account_request", requestId, r.hire_id, { service: r.service_name, desired_date: desired, note, status: input.status });
  });
}

// ---------------------------------------------------------------------------
// サービス別の配置・ログイン確認(iPhone・iPadそれぞれ)
// ---------------------------------------------------------------------------

const HS_FLAGS = {
  iphone_placed: { col: "iphone_placed_at", by: null, label: "iPhoneに配置" },
  ipad_placed: { col: "ipad_placed_at", by: null, label: "iPadに配置" },
  iphone_login: { col: "iphone_login_at", by: "iphone_login_by", label: "iPhoneでログイン確認" },
  ipad_login: { col: "ipad_login_at", by: "ipad_login_by", label: "iPadでログイン確認" },
  verified: { col: "verified_at", by: "verified_by", label: "内容確認(本人名・所属・権限・通知)" },
} as const;

export function updateHireService(db: DB, actor: Actor, hsId: number, input: Record<string, unknown>) {
  const hs = get<Record<string, unknown>>(
    db,
    `SELECT hs.*, s.name, s.needs_issuance FROM hire_services hs JOIN services s ON s.id = hs.service_id WHERE hs.id = ?`,
    hsId,
  );
  if (!hs) throw notFound();
  const hireId = hs.hire_id as number;
  assertPrepare(db, actor, hireId);
  tx(db, () => {
    const now = nowIso();
    for (const [key, def] of Object.entries(HS_FLAGS)) {
      if (!(key in input)) continue;
      const on = !!input[key];
      if (on && (key === "iphone_login" || key === "ipad_login") && hs.needs_issuance) {
        const req = get<{ status: string }>(db, "SELECT status FROM account_requests WHERE hire_id = ? AND service_id = ?", hireId, hs.service_id);
        if (!req || (req.status !== "issued" && req.status !== "login_confirmed")) {
          throw conflict(`「${hs.name}」はアカウントが発行済みになっていないため、ログイン確認を記録できません。`);
        }
      }
      run(db, `UPDATE hire_services SET ${def.col} = ?${def.by ? `, ${def.by} = ?` : ""} WHERE id = ?`,
        ...(def.by ? [on ? now : null, on ? actor.id : null] : [on ? now : null]), hsId);
      audit(db, actor, `${def.label}を${on ? "記録" : "取消"}`, "hire_service", hsId, hireId, { service: hs.name });
    }
    for (const key of ["iphone_target", "ipad_target"] as const) {
      if (key in input) {
        run(db, `UPDATE hire_services SET ${key} = ? WHERE id = ?`, input[key] ? 1 : 0, hsId);
        audit(db, actor, `${key === "iphone_target" ? "iPhone" : "iPad"}での利用を${input[key] ? "対象" : "対象外"}に変更`, "hire_service", hsId, hireId, { service: hs.name });
      }
    }
    if ("usage_decision" in input) {
      requireRole(actor, "admin");
      const d = input.usage_decision;
      if (d !== "use" && d !== "not_use" && d !== "pending") throw badRequest("利用要否の指定が正しくありません。");
      if (hs.requirement !== "confirm") throw badRequest("このサービスは利用要否の確認対象ではありません。");
      run(db, "UPDATE hire_services SET usage_decision = ? WHERE id = ?", d, hsId);
      audit(db, actor, "利用要否を決定", "hire_service", hsId, hireId, { service: hs.name, decision: d });
    }
    if ("note" in input) {
      const note = str(input.note);
      assertNoSecret(note, "備考");
      run(db, "UPDATE hire_services SET note = ? WHERE id = ?", note, hsId);
    }
    // 両端末でログイン確認できたら、発行依頼にログイン確認日を記録する
    const cur = get<Record<string, unknown>>(db, "SELECT * FROM hire_services WHERE id = ?", hsId)!;
    const loggedIn = (!cur.iphone_target || cur.iphone_login_at) && (!cur.ipad_target || cur.ipad_login_at);
    const req = get<{ id: number; status: string }>(db, "SELECT id, status FROM account_requests WHERE hire_id = ? AND service_id = ?", hireId, hs.service_id);
    if (req && loggedIn && req.status === "issued") {
      run(db, "UPDATE account_requests SET status = 'login_confirmed', login_confirmed_at = ?, login_confirmed_by = ? WHERE id = ?", todayStr(), actor.id, req.id);
      audit(db, actor, "ログイン確認済みを記録", "account_request", req.id, hireId, { service: hs.name });
    } else if (req && !loggedIn && req.status === "login_confirmed") {
      run(db, "UPDATE account_requests SET status = 'issued', login_confirmed_at = NULL, login_confirmed_by = NULL WHERE id = ?", req.id);
    }
  });
}

/** 部門の標準に後から追加されたサービスを、進行中の入職者に追加する(管理者) */
export function addServiceToHire(db: DB, actor: Actor, hireId: number, serviceId: unknown, requirement: unknown) {
  requireRole(actor, "admin");
  assertViewHire(db, actor, hireId);
  const sid = intOrNull(serviceId);
  const reqm = str(requirement) ?? "required";
  if (!["required", "optional", "confirm"].includes(reqm)) throw badRequest("区分が正しくありません。");
  const s = get<{ id: number; name: string; needs_issuance: number; standard_days: number | null }>(db, "SELECT * FROM services WHERE id = ? AND active = 1", sid);
  if (!s) throw notFound("サービスが見つかりません。");
  if (get(db, "SELECT 1 FROM hire_services WHERE hire_id = ? AND service_id = ?", hireId, s.id)) throw conflict("既に追加されています。");
  const start = get<{ start_date: string }>(db, "SELECT start_date FROM hires WHERE id = ?", hireId)!.start_date;
  tx(db, () => {
    addServiceRows(db, hireId, { ...s, requirement: reqm }, start);
    audit(db, actor, "サービスを追加", "hire_service", null, hireId, { service: s.name, requirement: reqm });
  });
}

// ---------------------------------------------------------------------------
// 認証情報の参照先(実際のパスワードは保存しない)
// ---------------------------------------------------------------------------

export function addCredentialRef(db: DB, actor: Actor, hireId: number, input: { label?: unknown; ref_location?: unknown }) {
  const hire = loadHireRef(db, hireId);
  assertPrepare(db, actor, hire.id);
  const label = str(input.label);
  const ref = str(input.ref_location);
  if (!label || !ref) throw badRequest("項目名と参照先(保管場所)を入力してください。");
  assertNoSecret(label, "項目名");
  assertNoSecret(ref, "参照先");
  const r = run(db, "INSERT INTO hire_credentials (hire_id, label, ref_location, created_at, created_by) VALUES (?,?,?,?,?)", hireId, label, ref, nowIso(), actor.id);
  // 履歴には参照先の中身を残さない
  audit(db, actor, "認証情報の参照先を登録", "credential", Number(r.lastInsertRowid), hireId, { label });
}

export function deleteCredentialRef(db: DB, actor: Actor, credId: number) {
  const c = get<{ hire_id: number; label: string }>(db, "SELECT hire_id, label FROM hire_credentials WHERE id = ?", credId);
  if (!c) throw notFound();
  assertPrepare(db, actor, c.hire_id);
  run(db, "DELETE FROM hire_credentials WHERE id = ?", credId);
  audit(db, actor, "認証情報の参照先を削除", "credential", credId, c.hire_id, { label: c.label });
}

export function companyGoogle(db: DB) {
  return getSetting(db, "company_google_account");
}
