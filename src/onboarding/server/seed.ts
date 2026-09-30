import { DB, all, get, nowIso, run, tx } from "./db";
import { hashPassword } from "./core";
import { DEFAULT_SETTINGS, DEPARTMENTS, JOB_TYPES, SERVICES, TEMPLATES } from "./masterData";

/** マスタデータ(部門・サービス・標準手順・設定)を投入します。既に投入済みなら何もしません。 */
export function seedMaster(db: DB) {
  if (get(db, "SELECT 1 FROM departments LIMIT 1")) return;
  const now = nowIso();
  tx(db, () => {
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      run(db, "INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?,?,?)", key, value, now);
    }
    for (const d of DEPARTMENTS) {
      run(db, "INSERT INTO departments (code, name, sort) VALUES (?,?,?)", d.code, d.name, d.sort);
    }
    for (const j of JOB_TYPES) run(db, "INSERT INTO job_types (name) VALUES (?)", j);

    const deptId = (code: string) => get<{ id: number }>(db, "SELECT id FROM departments WHERE code = ?", code)!.id;
    SERVICES.forEach((s, i) => {
      const r = run(
        db,
        `INSERT INTO services (code, name, placement, placement_confirmed, url, app_store_url, account_type, account_note,
          needs_issuance, requires_email, issuer_label, owner_mode, procedure, completion_criteria, standard_days, sort, updated_at)
         VALUES (?,?, 'unset', 0, NULL, NULL, ?,?,?,?,?,?,?,?,?,?,?)`,
        s.code, s.name, s.account_type, s.account_note, s.needs_issuance, s.requires_email, s.issuer_label,
        s.owner_mode, s.procedure, s.completion_criteria, s.standard_days, (i + 1) * 10, now,
      );
      const sid = Number(r.lastInsertRowid);
      run(db, "INSERT INTO department_services VALUES (?,?,?)", deptId("houmon"), sid, s.dept.houmon);
      run(db, "INSERT INTO department_services VALUES (?,?,?)", deptId("kyotaku"), sid, s.dept.kyotaku);
    });

    for (const t of TEMPLATES) {
      const r = run(
        db,
        `INSERT INTO task_templates (code, sort_no, title, assignee_type, requirement, prerequisites, procedure,
           completion_criteria, related_urls, account_info, device_check, due_offset_days, completion_mode, condition, version, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?)`,
        t.code, t.sort_no, t.title, t.assignee_type, t.requirement, JSON.stringify(t.prerequisites), t.procedure,
        t.completion_criteria, t.related_urls, t.account_info, t.device_check, t.due_offset_days, t.completion_mode,
        t.condition ?? null, now,
      );
      const tpl = get(db, "SELECT * FROM task_templates WHERE id = ?", Number(r.lastInsertRowid));
      run(
        db,
        "INSERT INTO template_revisions (template_id, version, snapshot, summary, changed_at, changed_by) VALUES (?,?,?,?,?,NULL)",
        Number(r.lastInsertRowid), 1, JSON.stringify(tpl), "初期登録", now,
      );
    }
  });
}

export function createUserRow(
  db: DB,
  u: { login_id: string; name: string; role: string; password: string; is_representative?: boolean; scope_office_ids?: number[] },
): number {
  const r = run(
    db,
    "INSERT INTO users (login_id, name, role, is_representative, scope_office_ids, password_hash, created_at) VALUES (?,?,?,?,?,?,?)",
    u.login_id, u.name, u.role, u.is_representative ? 1 : 0, JSON.stringify(u.scope_office_ids ?? []),
    hashPassword(u.password), nowIso(),
  );
  return Number(r.lastInsertRowid);
}

export function setSetting(db: DB, key: string, value: string | null, userId: number | null = null) {
  run(
    db,
    `INSERT INTO settings (key, value, updated_at, updated_by) VALUES (?,?,?,?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
    key, value, nowIso(), userId,
  );
}

export function isEmptyOfUsers(db: DB) {
  return !get(db, "SELECT 1 FROM users LIMIT 1");
}

export function userIdByLogin(db: DB, loginId: string): number {
  return get<{ id: number }>(db, "SELECT id FROM users WHERE login_id = ?", loginId)!.id;
}

export function listDeptIds(db: DB) {
  return Object.fromEntries(all<{ code: string; id: number }>(db, "SELECT code, id FROM departments").map((r) => [r.code, r.id]));
}
