import { DB, addDays, all, get, nowIso, run, tx } from "./db";
import {
  Actor, assertNoSecret, audit, badRequest, conflict, diffFields, getAllSettings, hashPassword, intOrNull, notFound,
  requireRole, str,
} from "./core";
import { SETTING_LABELS } from "./masterData";
import { lineDiff } from "../shared/diff";
import { ROLE_LABELS, Role } from "../shared/labels";

// ---------------------------------------------------------------------------
// 設定値
// ---------------------------------------------------------------------------

export function getSettingsView(db: DB) {
  const values = getAllSettings(db);
  return Object.keys(SETTING_LABELS).map((key) => ({ key, label: SETTING_LABELS[key], value: values[key] ?? null }));
}

export function updateSettings(db: DB, actor: Actor, input: Record<string, unknown>) {
  requireRole(actor, "admin");
  const before = getAllSettings(db);
  const changes: Record<string, { before: unknown; after: unknown }> = {};
  tx(db, () => {
    for (const [key, raw] of Object.entries(input)) {
      if (!(key in SETTING_LABELS)) throw badRequest(`不明な設定項目です: ${key}`);
      const value = str(raw);
      assertNoSecret(value, SETTING_LABELS[key]);
      if (key === "apple_last_issued" && value !== null) {
        const n = Number(value);
        if (!Number.isInteger(n) || n < 0 || n > 999) throw badRequest("発行済みの最新番号は0〜999の整数で入力してください。");
        const maxRow = get<{ m: number | null }>(db, "SELECT MAX(number) AS m FROM apple_numbers");
        if (maxRow?.m && n < Number(before[key] ?? 0)) throw badRequest("予約済みの番号がある場合、最新番号を小さくすることはできません。");
      }
      if (key === "prep_deadline_offset_days" && value !== null && !Number.isInteger(Number(value))) {
        throw badRequest("準備期限の日数は整数で入力してください(例: -3)。");
      }
      if ((before[key] ?? null) !== value) {
        changes[SETTING_LABELS[key]] = { before: before[key] ?? null, after: value };
        run(
          db,
          `INSERT INTO settings (key, value, updated_at, updated_by) VALUES (?,?,?,?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
          key, value, nowIso(), actor.id,
        );
      }
    }
    if (Object.keys(changes).length) audit(db, actor, "設定を変更", "settings", null, null, changes);
  });
}

// ---------------------------------------------------------------------------
// 初回に管理者が入力する未設定項目
// ---------------------------------------------------------------------------

export function unsetItems(db: DB) {
  const items: { area: string; item: string; where: string }[] = [];
  for (const s of getSettingsView(db)) {
    if (s.value === null) items.push({ area: "設定", item: s.label, where: "管理設定 > 基本設定" });
  }
  const services = all<Record<string, unknown>>(
    db,
    `SELECT s.*, (SELECT COUNT(*) FROM department_services ds WHERE ds.service_id = s.id AND ds.requirement <> 'excluded') AS used
       FROM services s WHERE s.active = 1 ORDER BY s.sort`,
  );
  for (const s of services) {
    if (!s.used) continue;
    const w = "管理設定 > サービス一覧";
    if (s.placement === "unset" || !s.placement_confirmed) items.push({ area: s.name as string, item: "配置方式(アプリ/Web)の確定", where: w });
    if ((s.placement === "web" || s.placement === "app_web") && !s.url) items.push({ area: s.name as string, item: "WebのURL", where: w });
    if ((s.placement === "app" || s.placement === "app_web") && !s.app_store_url) items.push({ area: s.name as string, item: "App StoreのURL", where: w });
    if (s.account_type === "unset") items.push({ area: s.name as string, item: "使用するアカウントの種類", where: w });
    if (s.needs_issuance && !s.issuer_user_id) items.push({ area: s.name as string, item: `発行担当者(ユーザー)${s.issuer_label ? `: 役割は「${s.issuer_label}」` : ""}`, where: w });
    if (s.needs_issuance && s.owner_mode === "unset") items.push({ area: s.name as string, item: "発行の担当区分(榎本対応/移管済み)", where: w });
    if (s.account_type !== "none" && !s.credential_ref) items.push({ area: s.name as string, item: "認証情報の参照先", where: w });
  }
  for (const r of all<{ dept: string; name: string }>(
    db,
    `SELECT d.name AS dept, s.name FROM department_services ds JOIN departments d ON d.id = ds.department_id
       JOIN services s ON s.id = ds.service_id WHERE ds.requirement = 'confirm' AND s.active = 1`,
  )) {
    items.push({ area: r.name, item: `${r.dept}での利用要否`, where: "管理設定 > 部門別サービス" });
  }
  if (!get(db, "SELECT 1 FROM offices WHERE active = 1")) items.push({ area: "事業所", item: "事業所の登録", where: "管理設定 > 事業所・職種" });
  if (!get(db, "SELECT 1 FROM users WHERE is_representative = 1 AND active = 1")) items.push({ area: "ユーザー", item: "代表者(榎本)のユーザー登録", where: "管理設定 > ユーザー" });
  if (!get(db, "SELECT 1 FROM users WHERE role = 'preparer' AND active = 1")) items.push({ area: "ユーザー", item: "準備担当者の登録", where: "管理設定 > ユーザー" });
  if (!get(db, "SELECT 1 FROM users WHERE role = 'issuer' AND active = 1")) items.push({ area: "ユーザー", item: "事務・発行責任者の登録", where: "管理設定 > ユーザー" });
  return items;
}

// ---------------------------------------------------------------------------
// サービス
// ---------------------------------------------------------------------------

export function listServices(db: DB, actor: Actor) {
  requireRole(actor, "admin");
  const services = all<Record<string, unknown>>(
    db,
    `SELECT s.*, ui.name AS issuer_name, ud.name AS deputy_name, uu.name AS updated_by_name
       FROM services s LEFT JOIN users ui ON ui.id = s.issuer_user_id LEFT JOIN users ud ON ud.id = s.deputy_user_id
       LEFT JOIN users uu ON uu.id = s.updated_by ORDER BY s.sort`,
  );
  const deptReq = all(db, "SELECT * FROM department_services");
  const departments = all(db, "SELECT * FROM departments ORDER BY sort");
  return { services, deptReq, departments };
}

const SERVICE_FIELDS = [
  "name", "placement", "placement_confirmed", "url", "app_store_url", "account_type", "account_note", "needs_issuance",
  "requires_email", "issuer_label", "issuer_user_id", "deputy_user_id", "owner_mode", "procedure", "completion_criteria",
  "standard_days", "credential_ref", "sort", "active",
] as const;

function normalizeService(input: Record<string, unknown>) {
  const s = {
    name: str(input.name),
    placement: str(input.placement) ?? "unset",
    placement_confirmed: input.placement_confirmed ? 1 : 0,
    url: str(input.url),
    app_store_url: str(input.app_store_url),
    account_type: str(input.account_type) ?? "unset",
    account_note: str(input.account_note),
    needs_issuance: input.needs_issuance ? 1 : 0,
    requires_email: input.requires_email ? 1 : 0,
    issuer_label: str(input.issuer_label),
    issuer_user_id: intOrNull(input.issuer_user_id),
    deputy_user_id: intOrNull(input.deputy_user_id),
    owner_mode: str(input.owner_mode) ?? "unset",
    procedure: str(input.procedure),
    completion_criteria: str(input.completion_criteria),
    standard_days: intOrNull(input.standard_days),
    credential_ref: str(input.credential_ref),
    sort: intOrNull(input.sort) ?? 999,
    active: input.active === undefined ? 1 : input.active ? 1 : 0,
  };
  if (!s.name) throw badRequest("サービス名を入力してください。");
  if (!["app", "web", "app_web", "unset"].includes(s.placement)) throw badRequest("配置方式が正しくありません。");
  if (!["individual_email", "company_google", "individual", "none", "unset"].includes(s.account_type)) throw badRequest("アカウント種類が正しくありません。");
  if (!["enomoto", "transferred", "unset"].includes(s.owner_mode)) throw badRequest("担当区分が正しくありません。");
  for (const u of [s.url, s.app_store_url]) if (u && !/^https?:\/\//.test(u)) throw badRequest("URLは http:// または https:// から入力してください。");
  if (s.placement_confirmed && s.placement === "unset") throw badRequest("配置方式を選んでから「確定済み」にしてください。");
  if (s.placement_confirmed && (s.placement === "web" || s.placement === "app_web") && !s.url) throw badRequest("Webで配置する場合はURLを入力してから確定してください。");
  if (s.owner_mode === "transferred" && s.needs_issuance && s.issuer_label?.includes("榎本")) {
    throw badRequest("「移管済み」にする場合は、発行担当(役割)を榎本以外に変更してください。");
  }
  assertNoSecret(s.credential_ref, "認証情報の参照先");
  assertNoSecret(s.account_note, "アカウントの説明");
  return s;
}

export function saveService(db: DB, actor: Actor, id: number | null, input: Record<string, unknown>) {
  requireRole(actor, "admin");
  return tx(db, () => {
    if (id === null) {
      const s = normalizeService(input);
      const code = "svc_" + Date.now().toString(36);
      const r = run(
        db,
        `INSERT INTO services (code, ${SERVICE_FIELDS.join(",")}, updated_at, updated_by) VALUES (?, ${SERVICE_FIELDS.map(() => "?").join(",")}, ?, ?)`,
        code, ...SERVICE_FIELDS.map((f) => s[f]), nowIso(), actor.id,
      );
      const newId = Number(r.lastInsertRowid);
      // 既定では全部門「対象外」で追加(部門別の設定で必須・任意を選ぶ)
      for (const d of all<{ id: number }>(db, "SELECT id FROM departments")) {
        run(db, "INSERT INTO department_services VALUES (?,?, 'excluded')", d.id, newId);
      }
      audit(db, actor, "サービスを追加", "service", newId, null, { ...s, credential_ref: s.credential_ref ? "(登録あり)" : null });
      return newId;
    }
    const before = get<Record<string, unknown>>(db, "SELECT * FROM services WHERE id = ?", id);
    if (!before) throw notFound("サービスが見つかりません。");
    const s = normalizeService({ ...before, ...input });
    const changes = diffFields(before, s);
    if (Object.keys(changes).length === 0) return id;
    // 履歴には参照先の中身を残さない
    if ("credential_ref" in changes) changes.credential_ref = { before: "(非表示)", after: s.credential_ref ? "(変更あり)" : "(削除)" };
    run(db, `UPDATE services SET ${SERVICE_FIELDS.map((f) => `${f} = ?`).join(", ")}, updated_at = ?, updated_by = ? WHERE id = ?`,
      ...SERVICE_FIELDS.map((f) => s[f]), nowIso(), actor.id, id);
    const assign = ["issuer_user_id", "deputy_user_id", "owner_mode", "issuer_label"].some((k) => k in changes);
    audit(db, actor, assign ? "サービスの発行担当を変更" : "サービスを更新", "service", id, null, { service: s.name, ...changes });
    return id;
  });
}

export function setDepartmentRequirement(db: DB, actor: Actor, departmentId: number, serviceId: number, requirement: unknown) {
  requireRole(actor, "admin");
  const reqm = str(requirement);
  if (!reqm || !["required", "optional", "excluded", "confirm"].includes(reqm)) throw badRequest("区分が正しくありません。");
  const before = get<{ requirement: string }>(db, "SELECT requirement FROM department_services WHERE department_id = ? AND service_id = ?", departmentId, serviceId);
  const names = get<{ d: string; s: string }>(db, "SELECT d.name AS d, s.name AS s FROM departments d, services s WHERE d.id = ? AND s.id = ?", departmentId, serviceId);
  if (!names) throw notFound();
  tx(db, () => {
    run(
      db,
      `INSERT INTO department_services VALUES (?,?,?) ON CONFLICT(department_id, service_id) DO UPDATE SET requirement = excluded.requirement`,
      departmentId, serviceId, reqm,
    );
    audit(db, actor, "部門別の必須・任意を変更", "department_service", serviceId, null, {
      department: names.d, service: names.s, before: before?.requirement ?? null, after: reqm,
    });
  });
}

// ---------------------------------------------------------------------------
// 標準手順(テンプレート)と改訂履歴
// ---------------------------------------------------------------------------

const TPL_FIELDS = [
  "title", "sort_no", "assignee_type", "fixed_user_id", "requirement", "prerequisites", "procedure", "completion_criteria",
  "related_urls", "account_info", "device_check", "due_offset_days", "owner_mode", "active",
] as const;
/** 入職者の作業に複製される項目(進行中の入職者へ適用するときに更新する項目) */
const SNAPSHOT_FIELDS = ["title", "requirement", "prerequisites", "procedure", "completion_criteria", "related_urls", "account_info", "device_check", "owner_mode"] as const;

export function listTemplates(db: DB) {
  return all<Record<string, unknown>>(
    db,
    `SELECT t.*, u.name AS updated_by_name,
            (SELECT COUNT(*) FROM hire_tasks ht JOIN hires h ON h.id = ht.hire_id
              WHERE ht.template_id = t.id AND ht.template_version < t.version AND ht.status NOT IN ('done','na') AND h.archived = 0) AS outdated_open
       FROM task_templates t LEFT JOIN users u ON u.id = t.updated_by ORDER BY t.sort_no`,
  );
}

export function templateRevisions(db: DB, templateId: number) {
  return all(
    db,
    `SELECT r.version, r.summary, r.changed_at, u.name AS changed_by_name FROM template_revisions r
       LEFT JOIN users u ON u.id = r.changed_by WHERE r.template_id = ? ORDER BY r.version DESC`,
    templateId,
  );
}

function normalizeTemplate(input: Record<string, unknown>) {
  let prereq: unknown = input.prerequisites;
  if (typeof prereq === "string") {
    const raw = prereq;
    try { prereq = JSON.parse(raw); } catch { prereq = raw.split(",").map((x) => x.trim()).filter(Boolean); }
  }
  const t = {
    title: str(input.title),
    sort_no: intOrNull(input.sort_no) ?? 999,
    assignee_type: str(input.assignee_type) ?? "preparer",
    fixed_user_id: intOrNull(input.fixed_user_id),
    requirement: str(input.requirement) ?? "required",
    prerequisites: JSON.stringify(Array.isArray(prereq) ? prereq : []),
    procedure: str(input.procedure) ?? "",
    completion_criteria: str(input.completion_criteria) ?? "",
    related_urls: str(input.related_urls) ?? "",
    account_info: str(input.account_info) ?? "",
    device_check: str(input.device_check) ?? "none",
    due_offset_days: intOrNull(input.due_offset_days) ?? -7,
    owner_mode: str(input.owner_mode) ?? "transferred",
    active: input.active === undefined ? 1 : input.active ? 1 : 0,
  };
  if (!t.title) throw badRequest("作業名を入力してください。");
  if (!["preparer", "checker", "fixed_user"].includes(t.assignee_type)) throw badRequest("担当の種類が正しくありません。");
  if (t.assignee_type === "fixed_user" && !t.fixed_user_id) throw badRequest("担当ユーザーを選択してください。");
  if (!["required", "optional"].includes(t.requirement)) throw badRequest("必須・任意の指定が正しくありません。");
  if (!["none", "both"].includes(t.device_check)) throw badRequest("端末確認の指定が正しくありません。");
  if (!["enomoto", "transferred", "unset"].includes(t.owner_mode)) throw badRequest("担当区分が正しくありません。");
  if (!t.completion_criteria) throw badRequest("完了条件を入力してください。");
  return t;
}

export function saveTemplate(db: DB, actor: Actor, id: number | null, input: Record<string, unknown>, summary?: unknown) {
  requireRole(actor, "admin");
  const note = str(summary);
  return tx(db, () => {
    const now = nowIso();
    if (id === null) {
      const t = normalizeTemplate(input);
      const code = "tpl_" + Date.now().toString(36);
      const r = run(
        db,
        `INSERT INTO task_templates (code, ${TPL_FIELDS.join(",")}, completion_mode, version, updated_at, updated_by)
         VALUES (?, ${TPL_FIELDS.map(() => "?").join(",")}, 'manual', 1, ?, ?)`,
        code, ...TPL_FIELDS.map((f) => t[f]), now, actor.id,
      );
      const newId = Number(r.lastInsertRowid);
      const snap = get(db, "SELECT * FROM task_templates WHERE id = ?", newId);
      run(db, "INSERT INTO template_revisions (template_id, version, snapshot, summary, changed_at, changed_by) VALUES (?,?,?,?,?,?)",
        newId, 1, JSON.stringify(snap), note ?? "新規追加", now, actor.id);
      audit(db, actor, "標準手順を追加", "template", newId, null, { title: t.title });
      return newId;
    }
    const before = get<Record<string, unknown>>(db, "SELECT * FROM task_templates WHERE id = ?", id);
    if (!before) throw notFound("標準手順が見つかりません。");
    const t = normalizeTemplate({ ...before, ...input });
    if (before.completion_mode === "system" && t.active === 0) throw badRequest("管理者確認・貸与の作業は無効にできません。");
    const changes = diffFields(before, t);
    if (Object.keys(changes).length === 0) return id;
    const version = Number(before.version) + 1;
    run(db, `UPDATE task_templates SET ${TPL_FIELDS.map((f) => `${f} = ?`).join(", ")}, version = ?, updated_at = ?, updated_by = ? WHERE id = ?`,
      ...TPL_FIELDS.map((f) => t[f]), version, now, actor.id, id);
    const snap = get(db, "SELECT * FROM task_templates WHERE id = ?", id);
    run(db, "INSERT INTO template_revisions (template_id, version, snapshot, summary, changed_at, changed_by) VALUES (?,?,?,?,?,?)",
      id, version, JSON.stringify(snap), note, now, actor.id);
    audit(db, actor, "標準手順を変更", "template", id, null, { title: t.title, version, summary: note, ...changes });
    return id;
  });
}

/**
 * 進行中の入職者へ手順変更を適用する前の差分確認。
 * 完了・対象外の作業は過去の記録として保持し、適用対象にしません。
 */
export function previewTemplateApply(db: DB, actor: Actor, templateId: number) {
  requireRole(actor, "admin");
  const tpl = get<Record<string, unknown>>(db, "SELECT * FROM task_templates WHERE id = ?", templateId);
  if (!tpl) throw notFound();
  const tasks = all<Record<string, unknown>>(
    db,
    `SELECT ht.*, h.name AS hire_name, h.start_date FROM hire_tasks ht JOIN hires h ON h.id = ht.hire_id
      WHERE ht.template_id = ? AND ht.template_version < ? AND ht.status NOT IN ('done','na') AND h.archived = 0 AND h.status <> 'lent'
      ORDER BY h.start_date`,
    templateId, tpl.version,
  );
  const outdated = tasks.map((t) => ({
    task_id: t.id,
    hire_id: t.hire_id,
    hire_name: t.hire_name,
    start_date: t.start_date,
    from_version: t.template_version,
    status: t.status,
    diffs: SNAPSHOT_FIELDS.filter((f) => String(t[f] ?? "") !== String(tpl[f] ?? "")).map((f) => ({
      field: f,
      lines: lineDiff(String(t[f] ?? ""), String(tpl[f] ?? "")),
    })),
  }));
  // 標準手順に新しく追加した作業を、準備中の入職者に追加できるようにする(条件付き作業は対象外)
  const missing = tpl.active && !tpl.condition
    ? all(
      db,
      `SELECT h.id AS hire_id, h.name AS hire_name, h.start_date FROM hires h
        WHERE h.archived = 0 AND h.status = 'preparing'
          AND NOT EXISTS (SELECT 1 FROM hire_tasks ht WHERE ht.hire_id = h.id AND ht.template_id = ?)`,
      templateId,
    )
    : [];
  const done = get<{ c: number }>(
    db,
    "SELECT COUNT(*) AS c FROM hire_tasks WHERE template_id = ? AND template_version < ? AND status IN ('done','na')",
    templateId, tpl.version,
  )!.c;
  return { template: tpl, outdated, missing, keptCompleted: done };
}

export function applyTemplate(db: DB, actor: Actor, templateId: number, input: { task_ids?: unknown; add_hire_ids?: unknown }) {
  requireRole(actor, "admin");
  const tpl = get<Record<string, unknown>>(db, "SELECT * FROM task_templates WHERE id = ?", templateId);
  if (!tpl) throw notFound();
  const taskIds = Array.isArray(input.task_ids) ? input.task_ids.map(Number) : [];
  const addHireIds = Array.isArray(input.add_hire_ids) ? input.add_hire_ids.map(Number) : [];
  let applied = 0;
  tx(db, () => {
    for (const id of taskIds) {
      const t = get<Record<string, unknown>>(db, "SELECT * FROM hire_tasks WHERE id = ? AND template_id = ?", id, templateId);
      if (!t) throw notFound("作業が見つかりません。");
      if (t.status === "done" || t.status === "na") throw conflict("完了・対象外の作業には適用できません(過去の記録は変更しません)。");
      run(db, `UPDATE hire_tasks SET ${SNAPSHOT_FIELDS.map((f) => `${f} = ?`).join(", ")}, template_version = ?, updated_at = ? WHERE id = ?`,
        ...SNAPSHOT_FIELDS.map((f) => tpl[f]), tpl.version, nowIso(), id);
      audit(db, actor, "手順の変更を適用", "task", id, t.hire_id as number, { title: tpl.title, from_version: t.template_version, to_version: tpl.version });
      applied++;
    }
    for (const hid of addHireIds) {
      const h = get<{ start_date: string; preparer_id: number | null; checker_id: number | null; status: string }>(db, "SELECT * FROM hires WHERE id = ?", hid);
      if (!h || h.status !== "preparing") throw conflict("準備中の入職者にのみ追加できます。");
      if (get(db, "SELECT 1 FROM hire_tasks WHERE hire_id = ? AND template_id = ?", hid, templateId)) continue;
      const assignee = tpl.assignee_type === "checker" ? h.checker_id : tpl.assignee_type === "fixed_user" ? (tpl.fixed_user_id as number) : h.preparer_id;
      run(
        db,
        `INSERT INTO hire_tasks (hire_id, template_id, template_code, template_version, sort_no, title, requirement, assignee_id, due_date, status,
           prerequisites, procedure, completion_criteria, related_urls, account_info, device_check, completion_mode, owner_mode, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?, 'todo', ?,?,?,?,?,?,?,?,?)`,
        hid, templateId, tpl.code, tpl.version, tpl.sort_no, tpl.title, tpl.requirement, assignee,
        addDays(h.start_date, Number(tpl.due_offset_days)), tpl.prerequisites, tpl.procedure, tpl.completion_criteria,
        tpl.related_urls, tpl.account_info, tpl.device_check, tpl.completion_mode, tpl.owner_mode, nowIso(),
      );
      audit(db, actor, "標準手順の作業を追加", "hire", hid, hid, { title: tpl.title, version: tpl.version });
      applied++;
    }
  });
  return { applied };
}

// ---------------------------------------------------------------------------
// 事業所・職種・ユーザー
// ---------------------------------------------------------------------------

export function saveOffice(db: DB, actor: Actor, id: number | null, input: Record<string, unknown>) {
  requireRole(actor, "admin");
  const name = str(input.name);
  if (!name) throw badRequest("事業所名を入力してください。");
  const dept = intOrNull(input.department_id);
  const active = input.active === undefined ? 1 : input.active ? 1 : 0;
  try {
    tx(db, () => {
      if (id === null) {
        const r = run(db, "INSERT INTO offices (name, department_id, active) VALUES (?,?,?)", name, dept, active);
        audit(db, actor, "事業所を追加", "office", Number(r.lastInsertRowid), null, { name });
      } else {
        run(db, "UPDATE offices SET name = ?, department_id = ?, active = ? WHERE id = ?", name, dept, active, id);
        audit(db, actor, "事業所を更新", "office", id, null, { name, active });
      }
    });
  } catch (e) {
    if (String(e).includes("UNIQUE")) throw conflict("同じ名前の事業所があります。");
    throw e;
  }
}

export function saveJobType(db: DB, actor: Actor, id: number | null, input: Record<string, unknown>) {
  requireRole(actor, "admin");
  const name = str(input.name);
  if (!name) throw badRequest("職種名を入力してください。");
  const active = input.active === undefined ? 1 : input.active ? 1 : 0;
  try {
    tx(db, () => {
      if (id === null) {
        const r = run(db, "INSERT INTO job_types (name, active) VALUES (?,?)", name, active);
        audit(db, actor, "職種を追加", "job_type", Number(r.lastInsertRowid), null, { name });
      } else {
        run(db, "UPDATE job_types SET name = ?, active = ? WHERE id = ?", name, active, id);
        audit(db, actor, "職種を更新", "job_type", id, null, { name, active });
      }
    });
  } catch (e) {
    if (String(e).includes("UNIQUE")) throw conflict("同じ名前の職種があります。");
    throw e;
  }
}

export function listUsers(db: DB) {
  return all<Record<string, unknown>>(
    db, "SELECT id, login_id, name, role, is_representative, scope_office_ids, active, created_at FROM users ORDER BY active DESC, role, id",
  ).map((u) => ({ ...u, scope_office_ids: JSON.parse(u.scope_office_ids as string) }));
}

export function saveUser(db: DB, actor: Actor, id: number | null, input: Record<string, unknown>) {
  requireRole(actor, "admin");
  const name = str(input.name);
  const login = str(input.login_id);
  const role = str(input.role) as Role | null;
  const password = typeof input.password === "string" && input.password !== "" ? input.password : null;
  if (!name || !login) throw badRequest("氏名とログインIDを入力してください。");
  if (!/^[A-Za-z0-9._-]{3,}$/.test(login)) throw badRequest("ログインIDは半角英数字3文字以上で入力してください。");
  if (!role || !(role in ROLE_LABELS)) throw badRequest("役割を選択してください。");
  if (password !== null && password.length < 8) throw badRequest("パスワードは8文字以上にしてください。");
  const scope = Array.isArray(input.scope_office_ids) ? input.scope_office_ids.map(Number).filter(Number.isInteger) : [];
  const isRep = input.is_representative ? 1 : 0;
  const active = input.active === undefined ? 1 : input.active ? 1 : 0;
  try {
    return tx(db, () => {
      if (id === null) {
        if (!password) throw badRequest("初期パスワードを入力してください(8文字以上)。");
        const r = run(
          db,
          "INSERT INTO users (login_id, name, role, is_representative, scope_office_ids, password_hash, active, created_at) VALUES (?,?,?,?,?,?,?,?)",
          login, name, role, isRep, JSON.stringify(scope), hashPassword(password), active, nowIso(),
        );
        const newId = Number(r.lastInsertRowid);
        audit(db, actor, "ユーザーを追加", "user", newId, null, { login_id: login, name, role: ROLE_LABELS[role] });
        return newId;
      }
      const before = get<Record<string, unknown>>(db, "SELECT * FROM users WHERE id = ?", id);
      if (!before) throw notFound();
      if (before.role === "admin" && (role !== "admin" || !active)) {
        const admins = get<{ c: number }>(db, "SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND active = 1 AND id <> ?", id)!.c;
        if (admins === 0) throw conflict("管理者が1人もいなくなるため変更できません。");
      }
      const after = { login_id: login, name, role, is_representative: isRep, scope_office_ids: JSON.stringify(scope), active };
      const changes = diffFields(before, after);
      run(db, "UPDATE users SET login_id = ?, name = ?, role = ?, is_representative = ?, scope_office_ids = ?, active = ? WHERE id = ?",
        login, name, role, isRep, JSON.stringify(scope), active, id);
      if (password) {
        run(db, "UPDATE users SET password_hash = ? WHERE id = ?", hashPassword(password), id);
        run(db, "DELETE FROM sessions WHERE user_id = ?", id);
        changes["パスワード"] = { before: "(非表示)", after: "(再設定)" };
      }
      if (!active) run(db, "DELETE FROM sessions WHERE user_id = ?", id);
      if (Object.keys(changes).length) audit(db, actor, "ユーザーを更新", "user", id, null, { name, ...changes });
      return id;
    });
  } catch (e) {
    if (String(e).includes("users.login_id")) throw conflict("このログインIDは既に使われています。");
    throw e;
  }
}

// ---------------------------------------------------------------------------
// 部門別の標準手順書(印刷用)・変更履歴
// ---------------------------------------------------------------------------

export function getManual(db: DB, departmentId: number) {
  const dept = get<Record<string, unknown>>(db, "SELECT * FROM departments WHERE id = ?", departmentId);
  if (!dept) throw notFound();
  const templates = all(
    db,
    `SELECT t.title, t.sort_no, t.requirement, t.assignee_type, t.prerequisites, t.procedure, t.completion_criteria, t.account_info,
            t.device_check, t.due_offset_days, t.version, t.updated_at, t.condition, t.code, u.name AS updated_by_name
       FROM task_templates t LEFT JOIN users u ON u.id = t.updated_by WHERE t.active = 1 ORDER BY t.sort_no`,
  );
  // 認証情報の参照先は手順書に含めない
  const services = all(
    db,
    `SELECT s.name, s.placement, s.placement_confirmed, s.url, s.app_store_url, s.account_type, s.account_note, s.needs_issuance,
            s.requires_email, s.issuer_label, s.owner_mode, s.procedure, s.completion_criteria, s.updated_at, ds.requirement,
            ui.name AS issuer_name, u.name AS updated_by_name
       FROM services s JOIN department_services ds ON ds.service_id = s.id AND ds.department_id = ?
       LEFT JOIN users ui ON ui.id = s.issuer_user_id LEFT JOIN users u ON u.id = s.updated_by
      WHERE s.active = 1 AND ds.requirement <> 'excluded' ORDER BY s.sort`,
    departmentId,
  );
  const excluded = all(
    db,
    `SELECT s.name FROM services s JOIN department_services ds ON ds.service_id = s.id AND ds.department_id = ?
      WHERE s.active = 1 AND ds.requirement = 'excluded' ORDER BY s.sort`,
    departmentId,
  );
  return { department: dept, templates, services, excluded, settings: getAllSettings(db) };
}

export function listAudit(db: DB, actor: Actor, filter: { entity?: string | null; limit?: number }) {
  requireRole(actor, "admin");
  const limit = Math.min(filter.limit ?? 300, 1000);
  if (filter.entity) {
    return all(db, "SELECT a.*, h.name AS hire_name FROM audit_logs a LEFT JOIN hires h ON h.id = a.hire_id WHERE a.entity = ? ORDER BY a.id DESC LIMIT ?", filter.entity, limit);
  }
  return all(db, "SELECT a.*, h.name AS hire_name FROM audit_logs a LEFT JOIN hires h ON h.id = a.hire_id ORDER BY a.id DESC LIMIT ?", limit);
}
