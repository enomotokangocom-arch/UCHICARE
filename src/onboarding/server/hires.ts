import { DB, addDays, all, get, nowIso, run, todayStr, tx } from "./db";
import {
  Actor, AppError, assertNoSecret, audit, badRequest, conflict, diffFields, forbidden, getSetting, intOrNull,
  isDate, requireRole, str,
} from "./core";
import { assertPrepare, assertViewHire, canPrepare, canViewCredentials, canViewHire, HireRef } from "./authz";
import { OPEN_STATUSES } from "../shared/labels";

export interface HireInput {
  name?: unknown; name_romaji?: unknown; job_type_id?: unknown; department_id?: unknown; office_id?: unknown;
  start_date?: unknown; prep_deadline?: unknown; preparer_id?: unknown; deputy_id?: unknown; checker_id?: unknown;
}

function validateUserRef(db: DB, id: number | null, label: string, roles?: string[]) {
  if (id === null) return;
  const u = get<{ role: string; active: number }>(db, "SELECT role, active FROM users WHERE id = ?", id);
  if (!u || !u.active) throw badRequest(`${label}のユーザーが見つかりません。`);
  if (roles && !roles.includes(u.role)) throw badRequest(`${label}には「${roles.join("・")}」の役割のユーザーを指定してください。`);
}

function normalizeHireInput(db: DB, input: HireInput) {
  const name = str(input.name);
  const romaji = str(input.name_romaji);
  const department_id = intOrNull(input.department_id);
  const start_date = str(input.start_date);
  if (!name) throw badRequest("氏名を入力してください。");
  if (!romaji || !/^[A-Za-z][A-Za-z .'-]*$/.test(romaji)) throw badRequest("氏名ローマ字を半角英字で入力してください(例: Taro Yamada)。");
  if (!department_id || !get(db, "SELECT 1 FROM departments WHERE id = ?", department_id)) throw badRequest("部門を選択してください。");
  if (!isDate(start_date)) throw badRequest("入社日を YYYY-MM-DD 形式で入力してください。");
  const prep = str(input.prep_deadline);
  if (prep !== null && !isDate(prep)) throw badRequest("準備期限の日付形式が正しくありません。");
  const offset = Number(getSetting(db, "prep_deadline_offset_days") ?? "-3");
  const out = {
    name,
    name_romaji: romaji,
    job_type_id: intOrNull(input.job_type_id),
    department_id,
    office_id: intOrNull(input.office_id),
    start_date,
    prep_deadline: prep ?? addDays(start_date, offset),
    preparer_id: intOrNull(input.preparer_id),
    deputy_id: intOrNull(input.deputy_id),
    checker_id: intOrNull(input.checker_id),
  };
  validateUserRef(db, out.preparer_id, "準備担当者", ["admin", "preparer"]);
  validateUserRef(db, out.deputy_id, "代行担当者", ["admin", "preparer"]);
  validateUserRef(db, out.checker_id, "確認管理者", ["admin"]);
  return out;
}

/** その入職者で「必須」として扱うサービス(必須、または利用要否確認で「使用する」に決まったもの) */
export const REQUIRED_HS_SQL = "(hs.requirement = 'required' OR (hs.requirement = 'confirm' AND hs.usage_decision = 'use'))";

/**
 * 入職者を登録し、部門に応じた作業・サービス・発行依頼を自動生成します。
 * 標準手順は作業ごとに「その時点の内容」を複製して保存するため、後で標準手順を変更しても
 * 過去の記録は書き換わりません。
 */
export function createHire(db: DB, actor: Actor, input: HireInput): number {
  requireRole(actor, "admin");
  const h = normalizeHireInput(db, input);
  return tx(db, () => {
    const now = nowIso();
    const r = run(
      db,
      `INSERT INTO hires (name, name_romaji, job_type_id, department_id, office_id, start_date, prep_deadline,
         preparer_id, deputy_id, checker_id, status, created_at, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?, 'preparing', ?, ?)`,
      h.name, h.name_romaji, h.job_type_id, h.department_id, h.office_id, h.start_date, h.prep_deadline,
      h.preparer_id, h.deputy_id, h.checker_id, now, actor.id,
    );
    const hireId = Number(r.lastInsertRowid);
    generateForHire(db, hireId);
    audit(db, actor, "入職者を登録", "hire", hireId, hireId, h);
    return hireId;
  });
}

function generateForHire(db: DB, hireId: number) {
  const hire = get<{ department_id: number; start_date: string; preparer_id: number | null; checker_id: number | null }>(
    db, "SELECT * FROM hires WHERE id = ?", hireId,
  )!;

  // サービス(部門別の必須・任意・利用要否確認。対象外は生成しない)
  const services = all<{ id: number; requirement: string; needs_issuance: number; standard_days: number | null; placement_confirmed: number }>(
    db,
    `SELECT s.id, ds.requirement, s.needs_issuance, s.standard_days, s.placement_confirmed
       FROM services s JOIN department_services ds ON ds.service_id = s.id
      WHERE ds.department_id = ? AND s.active = 1 AND ds.requirement <> 'excluded'
      ORDER BY s.sort`,
    hire.department_id,
  );
  for (const s of services) addServiceRows(db, hireId, s, hire.start_date);

  const hasUnconfirmed = services.some((s) => s.requirement !== "confirm" && !s.placement_confirmed);

  const templates = all<Record<string, unknown>>(db, "SELECT * FROM task_templates WHERE active = 1 ORDER BY sort_no");
  for (const t of templates) {
    if (t.condition === "unconfirmed_placement" && !hasUnconfirmed) continue;
    let assignee: number | null = null;
    if (t.assignee_type === "preparer") assignee = hire.preparer_id;
    else if (t.assignee_type === "checker") assignee = hire.checker_id;
    else if (t.assignee_type === "fixed_user") assignee = (t.fixed_user_id as number | null) ?? null;
    run(
      db,
      `INSERT INTO hire_tasks (hire_id, template_id, template_code, template_version, sort_no, title, requirement, assignee_id,
         due_date, status, prerequisites, procedure, completion_criteria, related_urls, account_info, device_check,
         completion_mode, owner_mode, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?, 'todo', ?,?,?,?,?,?,?,?,?)`,
      hireId, t.id, t.code, t.version, t.sort_no, t.title, t.requirement, assignee,
      addDays(hire.start_date, Number(t.due_offset_days)), t.prerequisites, t.procedure, t.completion_criteria,
      t.related_urls, t.account_info, t.device_check, t.completion_mode, t.owner_mode, nowIso(),
    );
  }
}

export function addServiceRows(
  db: DB, hireId: number,
  s: { id: number; requirement: string; needs_issuance: number; standard_days: number | null },
  startDate: string,
) {
  run(
    db,
    "INSERT OR IGNORE INTO hire_services (hire_id, service_id, requirement, usage_decision) VALUES (?,?,?,?)",
    hireId, s.id, s.requirement, s.requirement === "confirm" ? "pending" : null,
  );
  if (s.needs_issuance && s.requirement !== "confirm") {
    // 発行希望日: 入社日の7日前(サービスの標準日数が長い場合はさらに前倒し)
    const lead = Math.max(7, s.standard_days ?? 0);
    run(
      db,
      "INSERT OR IGNORE INTO account_requests (hire_id, service_id, status, desired_date) VALUES (?,?, 'not_requested', ?)",
      hireId, s.id, addDays(startDate, -lead),
    );
  }
}

// ---------------------------------------------------------------------------
// 集計
// ---------------------------------------------------------------------------

export interface HireProgress {
  required_total: number; required_done: number; required_rate: number;
  optional_total: number; optional_done: number;
  counts: Record<string, number>;
  overdue: number;
}

export function computeProgress(tasks: { requirement: string; status: string; due_date: string | null }[]): HireProgress {
  const today = todayStr();
  const req = tasks.filter((t) => t.requirement === "required" && t.status !== "na");
  const opt = tasks.filter((t) => t.requirement === "optional" && t.status !== "na");
  const counts: Record<string, number> = { todo: 0, doing: 0, waiting_issue: 0, waiting_check: 0, done: 0, na: 0 };
  for (const t of tasks) counts[t.status] = (counts[t.status] ?? 0) + 1;
  const reqDone = req.filter((t) => t.status === "done").length;
  return {
    required_total: req.length,
    required_done: reqDone,
    required_rate: req.length === 0 ? 100 : Math.round((reqDone / req.length) * 100),
    optional_total: opt.length,
    optional_done: opt.filter((t) => t.status === "done").length,
    counts,
    overdue: tasks.filter((t) => (OPEN_STATUSES as string[]).includes(t.status) && t.due_date && t.due_date < today).length,
  };
}

/** 準備完了にできない理由(未完了の必須作業)を返す。管理者確認・貸与はこの後の工程なので除外。 */
export function readinessBlockers(db: DB, hireId: number): string[] {
  const rows = all<{ title: string; status: string }>(
    db,
    `SELECT title, status FROM hire_tasks
      WHERE hire_id = ? AND requirement = 'required' AND completion_mode = 'manual' AND status NOT IN ('done','na')
      ORDER BY sort_no`,
    hireId,
  );
  const blockers = rows.map((r) => `必須作業「${r.title}」が完了していません`);
  const pendingUsage = all<{ name: string }>(
    db,
    `SELECT s.name FROM hire_services hs JOIN services s ON s.id = hs.service_id
      WHERE hs.hire_id = ? AND hs.requirement = 'confirm' AND hs.usage_decision = 'pending'`,
    hireId,
  );
  for (const p of pendingUsage) blockers.push(`「${p.name}」の利用要否が確認されていません`);
  return blockers;
}

// ---------------------------------------------------------------------------
// 状態遷移: 準備完了 → 管理者確認 → 貸与
// ---------------------------------------------------------------------------

function hireStatus(db: DB, hireId: number) {
  return get<{ status: string; checker_id: number | null }>(db, "SELECT status, checker_id FROM hires WHERE id = ?", hireId)!;
}

export function markReady(db: DB, actor: Actor, hireId: number) {
  assertPrepare(db, actor, hireId);
  tx(db, () => {
    const h = hireStatus(db, hireId);
    if (h.status !== "preparing") throw conflict("この入職者は既に準備完了以降の状態です。");
    const blockers = readinessBlockers(db, hireId);
    if (blockers.length) throw new AppError(409, "必須作業に未完了があるため、準備完了にできません。\n" + blockers.join("\n"));
    const now = nowIso();
    run(db, "UPDATE hires SET status = 'ready', ready_at = ?, ready_by = ? WHERE id = ?", now, actor.id, hireId);
    run(db, "UPDATE hire_tasks SET status = 'waiting_check', updated_at = ? WHERE hire_id = ? AND template_code = 'admin_confirm'", now, hireId);
    audit(db, actor, "準備完了にした", "hire", hireId, hireId);
  });
}

export function confirmHire(db: DB, actor: Actor, hireId: number, note: unknown) {
  requireRole(actor, "admin");
  assertViewHire(db, actor, hireId);
  const n = str(note);
  if (!n) throw badRequest("確認した内容を記録してください(例: iPhone・iPadで主要サービスの起動とログインを確認)。");
  assertNoSecret(n, "確認記録");
  tx(db, () => {
    const h = hireStatus(db, hireId);
    if (h.status !== "ready") throw conflict("準備担当者が「準備完了」にした入職者のみ確認できます。");
    const blockers = readinessBlockers(db, hireId);
    if (blockers.length) throw new AppError(409, "必須作業に未完了があるため確認できません。\n" + blockers.join("\n"));
    const now = nowIso();
    run(db, "UPDATE hires SET status = 'confirmed', confirmed_at = ?, confirmed_by = ?, confirm_note = ? WHERE id = ?", now, actor.id, n, hireId);
    run(
      db,
      "UPDATE hire_tasks SET status = 'done', completed_at = ?, completed_by = ?, updated_at = ? WHERE hire_id = ? AND template_code = 'admin_confirm'",
      now, actor.id, now, hireId,
    );
    audit(db, actor, "管理者確認を記録", "hire", hireId, hireId, { note: n });
  });
}

export function sendBack(db: DB, actor: Actor, hireId: number, reason: unknown) {
  requireRole(actor, "admin");
  assertViewHire(db, actor, hireId);
  const r = str(reason);
  if (!r) throw badRequest("差し戻しの理由を入力してください。");
  assertNoSecret(r, "差し戻し理由");
  tx(db, () => {
    const h = hireStatus(db, hireId);
    if (h.status === "preparing") throw conflict("既に準備中です。");
    if (h.status === "lent") throw conflict("貸与済みの入職者は差し戻せません。");
    const now = nowIso();
    run(db, "UPDATE hires SET status = 'preparing', confirmed_at = NULL, confirmed_by = NULL, confirm_note = NULL WHERE id = ?", hireId);
    run(
      db,
      "UPDATE hire_tasks SET status = 'todo', completed_at = NULL, completed_by = NULL, updated_at = ? WHERE hire_id = ? AND template_code = 'admin_confirm'",
      now, hireId,
    );
    audit(db, actor, "準備中に差し戻し", "hire", hireId, hireId, { reason: r });
  });
}

export function recordLending(db: DB, actor: Actor, hireId: number, input: { lent_date?: unknown; explanation_note?: unknown }) {
  assertPrepare(db, actor, hireId);
  const date = str(input.lent_date);
  const note = str(input.explanation_note);
  if (!isDate(date)) throw badRequest("貸与日を入力してください。");
  if (!note) throw badRequest("操作説明の内容を記録してください。");
  assertNoSecret(note, "操作説明の記録");
  tx(db, () => {
    const h = hireStatus(db, hireId);
    if (h.status !== "confirmed") throw conflict("管理者の確認が済んでいないため、貸与を記録できません。");
    const now = nowIso();
    run(db, "UPDATE hires SET status = 'lent', lent_date = ?, lent_by = ?, explanation_note = ? WHERE id = ?", date, actor.id, note, hireId);
    run(
      db,
      "UPDATE hire_tasks SET status = 'done', completed_at = ?, completed_by = ?, updated_at = ? WHERE hire_id = ? AND template_code = 'lend'",
      now, actor.id, now, hireId,
    );
    run(db, "UPDATE devices SET lend_status = 'lent', lent_date = ?, updated_at = ? WHERE hire_id = ?", date, now, hireId);
    audit(db, actor, "貸与を記録", "hire", hireId, hireId, { lent_date: date, note });
  });
}

// ---------------------------------------------------------------------------
// 基本情報・担当者の変更
// ---------------------------------------------------------------------------

const ASSIGN_FIELDS = ["preparer_id", "deputy_id", "checker_id"] as const;

export function updateHire(db: DB, actor: Actor, hireId: number, input: HireInput) {
  const ref = assertViewHire(db, actor, hireId);
  if (!canPrepare(actor, ref)) throw forbidden();
  const before = get<Record<string, unknown>>(db, "SELECT * FROM hires WHERE id = ?", hireId)!;
  const merged = normalizeHireInput(db, { ...before, ...input });
  if (merged.department_id !== before.department_id) {
    throw badRequest("部門の変更は作業の作り直しが必要なため、管理者が入職者を登録し直してください。");
  }
  const changes = diffFields(before, merged);
  const assignChanged = ASSIGN_FIELDS.some((f) => f in changes);
  if (assignChanged && actor.role !== "admin") throw forbidden("担当者の変更は管理者のみ行えます。");
  if (Object.keys(changes).length === 0) return;
  tx(db, () => {
    run(
      db,
      `UPDATE hires SET name=?, name_romaji=?, job_type_id=?, office_id=?, start_date=?, prep_deadline=?,
         preparer_id=?, deputy_id=?, checker_id=? WHERE id = ?`,
      merged.name, merged.name_romaji, merged.job_type_id, merged.office_id, merged.start_date, merged.prep_deadline,
      merged.preparer_id, merged.deputy_id, merged.checker_id, hireId,
    );
    // 準備担当・確認管理者が変わったら、未完了作業の担当も引き継ぐ
    if ("preparer_id" in changes) {
      run(
        db,
        `UPDATE hire_tasks SET assignee_id = ? WHERE hire_id = ? AND status NOT IN ('done','na')
           AND (assignee_id IS ? OR assignee_id = ?) AND template_code NOT IN ('admin_confirm','confirm_placement')`,
        merged.preparer_id, hireId, before.preparer_id, before.preparer_id,
      );
    }
    if ("checker_id" in changes) {
      run(
        db,
        `UPDATE hire_tasks SET assignee_id = ? WHERE hire_id = ? AND status NOT IN ('done','na')
           AND template_code IN ('admin_confirm','confirm_placement')`,
        merged.checker_id, hireId,
      );
    }
    audit(db, actor, assignChanged ? "担当者を変更" : "入職者情報を更新", "hire", hireId, hireId, changes);
  });
}

// ---------------------------------------------------------------------------
// 詳細取得(権限に応じて項目を絞る)
// ---------------------------------------------------------------------------

export function getHireDetail(db: DB, actor: Actor, hireId: number, opts: { print?: boolean } = {}) {
  const ref = assertViewHire(db, actor, hireId);
  const hire = get<Record<string, unknown>>(
    db,
    `SELECT h.*, d.name AS department_name, d.code AS department_code, o.name AS office_name, j.name AS job_type_name,
            up.name AS preparer_name, ud.name AS deputy_name, uc.name AS checker_name,
            ucf.name AS confirmed_by_name, ul.name AS lent_by_name
       FROM hires h
       JOIN departments d ON d.id = h.department_id
       LEFT JOIN offices o ON o.id = h.office_id
       LEFT JOIN job_types j ON j.id = h.job_type_id
       LEFT JOIN users up ON up.id = h.preparer_id
       LEFT JOIN users ud ON ud.id = h.deputy_id
       LEFT JOIN users uc ON uc.id = h.checker_id
       LEFT JOIN users ucf ON ucf.id = h.confirmed_by
       LEFT JOIN users ul ON ul.id = h.lent_by
      WHERE h.id = ?`,
    hireId,
  )!;

  const tasks = all<Record<string, unknown>>(
    db,
    `SELECT t.id, t.template_code, t.template_version, t.sort_no, t.title, t.requirement, t.assignee_id, u.name AS assignee_name,
            t.due_date, t.status, t.na_reason, t.device_check, t.completion_mode, t.owner_mode,
            t.iphone_checked_at, t.ipad_checked_at, t.completed_at, uc.name AS completed_by_name,
            tt.version AS template_current_version
       FROM hire_tasks t
       LEFT JOIN users u ON u.id = t.assignee_id
       LEFT JOIN users uc ON uc.id = t.completed_by
       LEFT JOIN task_templates tt ON tt.id = t.template_id
      WHERE t.hire_id = ? ORDER BY t.sort_no`,
    hireId,
  );

  const services = all<Record<string, unknown>>(
    db,
    `SELECT hs.*, s.name, s.code, s.placement, s.placement_confirmed, s.url, s.app_store_url, s.account_type, s.account_note,
            s.needs_issuance, s.requires_email, s.owner_mode, s.issuer_label
       FROM hire_services hs JOIN services s ON s.id = hs.service_id
      WHERE hs.hire_id = ? ORDER BY s.sort`,
    hireId,
  );

  const requests = all<Record<string, unknown>>(
    db,
    `SELECT ar.*, s.name AS service_name, s.requires_email, s.issuer_label, s.owner_mode, s.issuer_user_id, s.deputy_user_id,
            ui.name AS issuer_name, udp.name AS issuer_deputy_name, urb.name AS requested_by_name
       FROM account_requests ar JOIN services s ON s.id = ar.service_id
       LEFT JOIN users ui ON ui.id = s.issuer_user_id
       LEFT JOIN users udp ON udp.id = s.deputy_user_id
       LEFT JOIN users urb ON urb.id = ar.requested_by
      WHERE ar.hire_id = ? ORDER BY s.sort`,
    hireId,
  );

  const apple = all<Record<string, unknown>>(
    db,
    `SELECT a.*, u.name AS reserved_by_name FROM apple_numbers a LEFT JOIN users u ON u.id = a.reserved_by
      WHERE a.hire_id = ? ORDER BY a.number`,
    hireId,
  );
  const activeApple = apple.find((a) => a.status === "reserved" || a.status === "created") ?? null;
  const confirmedEmail = apple.find((a) => a.status === "created")?.actual_email ?? null;

  const showCreds = !opts.print && canViewCredentials(actor, ref);
  const devices = all<Record<string, unknown>>(
    db,
    `SELECT dv.id, dv.asset_no, dv.kind, dv.model, dv.serial, dv.phone_number, dv.auth_code_destination,
            dv.lend_status, dv.lent_date, dv.apple_number_id, a.actual_email AS apple_actual_email, a.planned_email AS apple_planned_email,
            um.name AS auth_manager_name ${showCreds ? ", dv.passcode_ref" : ""}
       FROM devices dv LEFT JOIN apple_numbers a ON a.id = dv.apple_number_id LEFT JOIN users um ON um.id = dv.auth_manager_id
      WHERE dv.hire_id = ? ORDER BY dv.kind DESC, dv.asset_no`,
    hireId,
  );

  const credentials = showCreds
    ? all(db, "SELECT c.id, c.label, c.ref_location, c.created_at, u.name AS created_by_name FROM hire_credentials c LEFT JOIN users u ON u.id = c.created_by WHERE c.hire_id = ?", hireId)
    : null;

  const history = actor.role === "admin" || actor.role === "preparer"
    ? all(db, "SELECT at, user_name, action, entity, detail FROM audit_logs WHERE hire_id = ? ORDER BY id DESC LIMIT 200", hireId)
    : [];

  const progress = computeProgress(tasks as never);
  const blockers = readinessBlockers(db, hireId);
  const today = todayStr();
  const openItems = [
    ...tasks
      .filter((t) => (OPEN_STATUSES as string[]).includes(t.status as string))
      .map((t) => ({
        kind: "作業", title: t.title, assignee: t.assignee_name ?? null, due: t.due_date,
        overdue: !!t.due_date && (t.due_date as string) < today, requirement: t.requirement,
      })),
    ...requests
      .filter((r) => r.status === "not_requested" || r.status === "requested" || r.status === "issued")
      .map((r) => ({
        kind: "発行",
        title: `${r.service_name}(${r.status === "not_requested" ? "未依頼" : r.status === "requested" ? "発行待ち" : "ログイン未確認"})`,
        assignee: (r.issuer_name as string) ?? (r.issuer_label as string) ?? null,
        due: r.desired_date, overdue: !!r.desired_date && (r.desired_date as string) < today, requirement: "required",
      })),
  ];

  const perms = {
    canPrepare: canPrepare(actor, ref),
    canAdmin: actor.role === "admin",
    canViewCredentials: showCreds,
  };

  return {
    hire, tasks, services, requests, apple, activeApple, confirmedEmail, devices, credentials, history,
    progress, blockers, openItems, perms,
  };
}

// ---------------------------------------------------------------------------
// 一覧(ダッシュボード)
// ---------------------------------------------------------------------------

export interface HireFilter {
  hire_id?: number | null; department_id?: number | null; office_id?: number | null;
  assignee_id?: number | null; status?: string | null;
}

export function listVisibleHireRefs(db: DB, actor: Actor): HireRef[] {
  const rows = all<HireRef>(db, "SELECT id, office_id, preparer_id, deputy_id, checker_id FROM hires WHERE archived = 0");
  return rows.filter((h) => canViewHire(db, actor, h));
}

export function dashboard(db: DB, actor: Actor, filter: HireFilter = {}) {
  const today = todayStr();
  const visibleIds = listVisibleHireRefs(db, actor).map((h) => h.id);
  if (visibleIds.length === 0) {
    return { hires: [], counts: { todo: 0, doing: 0, waiting_issue: 0, waiting_check: 0 }, overdueTasks: [], enomotoTasks: [], statusCounts: {} };
  }
  const idList = visibleIds.join(",");
  let hires = all<Record<string, unknown>>(
    db,
    `SELECT h.id, h.name, h.name_romaji, h.start_date, h.prep_deadline, h.status, h.department_id, h.office_id,
            h.preparer_id, h.deputy_id, d.name AS department_name, o.name AS office_name, j.name AS job_type_name,
            up.name AS preparer_name, ud.name AS deputy_name,
            (SELECT COALESCE(a.actual_email, a.planned_email) FROM apple_numbers a WHERE a.hire_id = h.id AND a.status IN ('reserved','created') LIMIT 1) AS apple_email,
            (SELECT a.status FROM apple_numbers a WHERE a.hire_id = h.id AND a.status IN ('reserved','created') LIMIT 1) AS apple_status
       FROM hires h JOIN departments d ON d.id = h.department_id
       LEFT JOIN offices o ON o.id = h.office_id LEFT JOIN job_types j ON j.id = h.job_type_id
       LEFT JOIN users up ON up.id = h.preparer_id LEFT JOIN users ud ON ud.id = h.deputy_id
      WHERE h.id IN (${idList}) ORDER BY h.start_date, h.id`,
  );
  if (filter.hire_id) hires = hires.filter((h) => h.id === filter.hire_id);
  if (filter.department_id) hires = hires.filter((h) => h.department_id === filter.department_id);
  if (filter.office_id) hires = hires.filter((h) => h.office_id === filter.office_id);
  if (filter.status) hires = hires.filter((h) => h.status === filter.status);

  const taskRows = all<Record<string, unknown>>(
    db,
    `SELECT t.id, t.hire_id, t.title, t.requirement, t.status, t.due_date, t.assignee_id, t.owner_mode, u.name AS assignee_name,
            u.is_representative, h.name AS hire_name
       FROM hire_tasks t JOIN hires h ON h.id = t.hire_id LEFT JOIN users u ON u.id = t.assignee_id
      WHERE t.hire_id IN (${idList})`,
  );
  if (filter.assignee_id) {
    const ids = new Set(taskRows.filter((t) => t.assignee_id === filter.assignee_id).map((t) => t.hire_id));
    hires = hires.filter((h) => ids.has(h.id) || h.preparer_id === filter.assignee_id || h.deputy_id === filter.assignee_id);
  }
  const shownIds = new Set(hires.map((h) => h.id));
  const shownTasks = taskRows.filter((t) => shownIds.has(t.hire_id));

  for (const h of hires) {
    h.progress = computeProgress(shownTasks.filter((t) => t.hire_id === h.id) as never);
  }

  const counts = { todo: 0, doing: 0, waiting_issue: 0, waiting_check: 0 };
  for (const t of shownTasks) if (t.status as string in counts) counts[t.status as keyof typeof counts]++;

  const isOpen = (s: unknown) => (OPEN_STATUSES as string[]).includes(s as string);
  const overdueTasks = shownTasks
    .filter((t) => isOpen(t.status) && t.due_date && (t.due_date as string) < today)
    .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));

  // 榎本の対応が必要な作業: 代表者に割り当てられた作業 + 榎本対応のサービス(移管前)の未発行依頼
  const enomotoTasks: Record<string, unknown>[] = shownTasks
    .filter((t) => isOpen(t.status) && (t.is_representative || t.owner_mode === "enomoto"))
    .map((t) => ({ kind: "作業", hire_id: t.hire_id, hire_name: t.hire_name, title: t.title, due_date: t.due_date, status: t.status }));
  if (shownIds.size) {
    const reqs = all<Record<string, unknown>>(
      db,
      `SELECT ar.hire_id, h.name AS hire_name, s.name AS service_name, ar.status, ar.desired_date
         FROM account_requests ar JOIN services s ON s.id = ar.service_id JOIN hires h ON h.id = ar.hire_id
         LEFT JOIN users ui ON ui.id = s.issuer_user_id
        WHERE ar.hire_id IN (${[...shownIds].join(",")}) AND ar.status IN ('not_requested','requested')
          AND (s.owner_mode = 'enomoto' OR ui.is_representative = 1)`,
    );
    for (const r of reqs) {
      enomotoTasks.push({
        kind: "発行", hire_id: r.hire_id, hire_name: r.hire_name,
        title: `${r.service_name} のアカウント発行(${r.status === "not_requested" ? "未依頼" : "発行待ち"})`,
        due_date: r.desired_date, status: r.status,
      });
    }
  }

  const statusCounts: Record<string, number> = { preparing: 0, ready: 0, confirmed: 0, lent: 0 };
  for (const h of hires) statusCounts[h.status as string]++;

  return { hires, counts, overdueTasks, enomotoTasks, statusCounts };
}
