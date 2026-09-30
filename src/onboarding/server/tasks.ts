import { DB, all, get, nowIso, run, tx } from "./db";
import { Actor, AppError, assertNoSecret, audit, badRequest, conflict, forbidden, getSetting, intOrNull, isDate, notFound, str } from "./core";
import { assertViewHire, canPrepare, canUpdateTask, canViewCredentials, loadHireRef } from "./authz";
import { REQUIRED_HS_SQL } from "./hires";
import { TASK_STATUSES, TASK_STATUS_LABELS, TaskStatus } from "../shared/labels";

type TaskRow = {
  id: number; hire_id: number; template_code: string | null; title: string; requirement: string; status: TaskStatus;
  assignee_id: number | null; due_date: string | null; device_check: string; completion_mode: string;
  prerequisites: string; iphone_checked_at: string | null; ipad_checked_at: string | null;
};

function loadTask(db: DB, taskId: number): TaskRow {
  const t = get<TaskRow>(db, "SELECT * FROM hire_tasks WHERE id = ?", taskId);
  if (!t) throw notFound("作業が見つかりません。");
  return t;
}

/**
 * 作業ごとの完了条件の自動チェック。
 * チェックを付けるだけで完了にならないよう、記録が揃っているかをサーバー側で確認します。
 */
export function completionProblems(db: DB, task: TaskRow): string[] {
  const problems: string[] = [];
  const hireId = task.hire_id;

  // 前提となる作業
  const prereqCodes: string[] = JSON.parse(task.prerequisites || "[]");
  if (prereqCodes.length) {
    const pre = all<{ title: string; status: string }>(
      db,
      `SELECT title, status FROM hire_tasks WHERE hire_id = ? AND template_code IN (${prereqCodes.map(() => "?").join(",")})`,
      hireId, ...prereqCodes,
    );
    for (const p of pre) if (p.status !== "done" && p.status !== "na") problems.push(`前提作業「${p.title}」が完了していません`);
  }

  // iPhone・iPadそれぞれの確認
  if (task.device_check === "both") {
    if (!task.iphone_checked_at) problems.push("iPhoneの確認欄にチェックがありません");
    if (!task.ipad_checked_at) problems.push("iPadの確認欄にチェックがありません");
  }

  const devices = all<{ kind: string; auth_code_destination: string | null; auth_manager_id: number | null }>(
    db, "SELECT kind, auth_code_destination, auth_manager_id FROM devices WHERE hire_id = ?", hireId,
  );
  const reqServices = () =>
    all<Record<string, unknown>>(
      db,
      `SELECT hs.*, s.name, s.placement_confirmed FROM hire_services hs JOIN services s ON s.id = hs.service_id
        WHERE hs.hire_id = ? AND ${REQUIRED_HS_SQL}`,
      hireId,
    );

  switch (task.template_code) {
    case "device_register":
      if (!devices.some((d) => d.kind === "iPhone")) problems.push("端末台帳にこの入職者のiPhoneが登録されていません");
      if (!devices.some((d) => d.kind === "iPad")) problems.push("端末台帳にこの入職者のiPadが登録されていません");
      break;
    case "apple_reserve":
      if (!get(db, "SELECT 1 FROM apple_numbers WHERE hire_id = ? AND status IN ('reserved','created')", hireId))
        problems.push("Appleアカウントの番号が予約されていません");
      break;
    case "apple_create":
      if (!get(db, "SELECT 1 FROM apple_numbers WHERE hire_id = ? AND status = 'created'", hireId))
        problems.push("Appleアカウントが「作成済み」として記録されていません(メールアドレス未確定)");
      break;
    case "recovery_record":
      if (devices.length === 0 || devices.some((d) => !d.auth_code_destination || !d.auth_manager_id))
        problems.push("端末台帳に認証コード受信先と認証先の管理担当者が記録されていません");
      if (!get(db, "SELECT 1 FROM hire_credentials WHERE hire_id = ?", hireId))
        problems.push("復旧情報の「認証情報の参照先」が登録されていません");
      break;
    case "issue_request": {
      const pending = all<{ name: string }>(
        db,
        `SELECT s.name FROM account_requests ar JOIN services s ON s.id = ar.service_id
           JOIN hire_services hs ON hs.hire_id = ar.hire_id AND hs.service_id = ar.service_id
          WHERE ar.hire_id = ? AND ar.status = 'not_requested' AND ${REQUIRED_HS_SQL}`,
        hireId,
      );
      for (const p of pending) problems.push(`「${p.name}」の発行を依頼した記録がありません`);
      break;
    }
    case "confirm_placement":
      for (const s of reqServices()) if (!s.placement_confirmed) problems.push(`「${s.name}」の配置方式が管理設定で確定されていません`);
      break;
    case "app_placement":
      for (const s of reqServices()) {
        if (s.iphone_target && !s.iphone_placed_at) problems.push(`「${s.name}」がiPhoneに配置されていません`);
        if (s.ipad_target && !s.ipad_placed_at) problems.push(`「${s.name}」がiPadに配置されていません`);
      }
      break;
    case "service_login":
      for (const s of reqServices()) {
        if (s.iphone_target && !s.iphone_login_at) problems.push(`「${s.name}」のiPhoneでのログイン確認がありません`);
        if (s.ipad_target && !s.ipad_login_at) problems.push(`「${s.name}」のiPadでのログイン確認がありません`);
      }
      break;
    case "service_verify":
      for (const s of reqServices()) if (!s.verified_at) problems.push(`「${s.name}」の内容確認(本人名・所属・権限・通知)がありません`);
      break;
    case "open_items": {
      const missing = all<{ title: string }>(
        db,
        `SELECT title FROM hire_tasks WHERE hire_id = ? AND id <> ? AND status IN ('todo','doing','waiting_issue','waiting_check')
           AND completion_mode = 'manual' AND (assignee_id IS NULL OR due_date IS NULL)`,
        hireId, task.id,
      );
      for (const m of missing) problems.push(`未完了の作業「${m.title}」に対応者または期限がありません`);
      break;
    }
  }
  return problems;
}

export function updateTaskStatus(db: DB, actor: Actor, taskId: number, input: { status?: unknown; na_reason?: unknown }) {
  const task = loadTask(db, taskId);
  const hire = assertViewHire(db, actor, task.hire_id);
  if (!canUpdateTask(actor, hire, task)) throw forbidden("この作業を更新する権限がありません。");
  const status = str(input.status) as TaskStatus | null;
  if (!status || !TASK_STATUSES.includes(status)) throw badRequest("作業状態が正しくありません。");
  if (task.completion_mode === "system") {
    throw conflict("この作業は入職者詳細の「管理者確認を記録」「貸与を記録」で自動的に完了します。");
  }
  const naReason = str(input.na_reason);
  if (status === "na") {
    if (!naReason) throw badRequest("「対象外」にする場合は理由を入力してください。");
    assertNoSecret(naReason, "対象外の理由");
  }
  if (status === "done") {
    const problems = completionProblems(db, task);
    if (problems.length) throw new AppError(409, "完了条件を満たしていないため、完了にできません。\n" + problems.join("\n"));
  }
  tx(db, () => {
    const now = nowIso();
    const done = status === "done";
    run(
      db,
      `UPDATE hire_tasks SET status = ?, na_reason = ?, completed_at = ?, completed_by = ?, updated_at = ? WHERE id = ?`,
      status, status === "na" ? naReason : null, done ? now : null, done ? actor.id : null, now, taskId,
    );
    audit(db, actor, "作業状態を変更", "task", taskId, task.hire_id, {
      title: task.title,
      before: TASK_STATUS_LABELS[task.status],
      after: TASK_STATUS_LABELS[status],
      ...(status === "na" ? { reason: naReason } : {}),
    });
    // 準備完了後に必須作業が未完了へ戻った場合は、入職者を準備中に戻す
    const h = get<{ status: string }>(db, "SELECT status FROM hires WHERE id = ?", task.hire_id)!;
    if (task.requirement === "required" && status !== "done" && status !== "na" && (h.status === "ready" || h.status === "confirmed")) {
      run(db, "UPDATE hires SET status = 'preparing', confirmed_at = NULL, confirmed_by = NULL, confirm_note = NULL WHERE id = ?", task.hire_id);
      run(db, "UPDATE hire_tasks SET status = 'todo', completed_at = NULL, completed_by = NULL WHERE hire_id = ? AND template_code = 'admin_confirm'", task.hire_id);
      audit(db, null, "必須作業が未完了に戻ったため準備中に戻した", "hire", task.hire_id, task.hire_id, { task: task.title });
    }
  });
}

export function setDeviceCheck(db: DB, actor: Actor, taskId: number, device: unknown, checked: unknown) {
  const task = loadTask(db, taskId);
  const hire = assertViewHire(db, actor, task.hire_id);
  if (!canUpdateTask(actor, hire, task)) throw forbidden("この作業を更新する権限がありません。");
  if (task.device_check !== "both") throw badRequest("この作業には端末ごとの確認欄がありません。");
  if (device !== "iphone" && device !== "ipad") throw badRequest("端末の指定が正しくありません。");
  if (task.status === "done") throw conflict("完了済みの作業の確認欄は変更できません。先に状態を戻してください。");
  const now = nowIso();
  tx(db, () => {
    run(
      db,
      `UPDATE hire_tasks SET ${device}_checked_at = ?, ${device}_checked_by = ?, updated_at = ?,
         status = CASE WHEN status = 'todo' THEN 'doing' ELSE status END WHERE id = ?`,
      checked ? now : null, checked ? actor.id : null, now, taskId,
    );
    audit(db, actor, `${device === "iphone" ? "iPhone" : "iPad"}の確認を${checked ? "記録" : "取消"}`, "task", taskId, task.hire_id, { title: task.title });
  });
}

export function addTaskComment(db: DB, actor: Actor, taskId: number, body: unknown) {
  const task = loadTask(db, taskId);
  const hire = assertViewHire(db, actor, task.hire_id);
  if (!canUpdateTask(actor, hire, task)) throw forbidden("この作業にコメントする権限がありません。");
  const text = str(body);
  if (!text) throw badRequest("コメントを入力してください。");
  assertNoSecret(text, "コメント");
  run(db, "INSERT INTO task_comments (task_id, user_id, body, created_at) VALUES (?,?,?,?)", taskId, actor.id, text, nowIso());
  audit(db, actor, "コメントを追加", "task", taskId, task.hire_id, { title: task.title });
}

/** 担当者の変更は管理者のみ。期限は準備担当者も変更可(未完了項目の期限記録のため)。 */
export function updateTaskAssignment(db: DB, actor: Actor, taskId: number, input: { assignee_id?: unknown; due_date?: unknown }) {
  const task = loadTask(db, taskId);
  const hire = assertViewHire(db, actor, task.hire_id);
  const changes: Record<string, { before: unknown; after: unknown }> = {};
  let assignee = task.assignee_id;
  let due = task.due_date;
  if (input.assignee_id !== undefined) {
    const next = intOrNull(input.assignee_id);
    if (next !== task.assignee_id) {
      if (actor.role !== "admin") throw forbidden("担当者の変更は管理者のみ行えます。");
      if (next !== null) {
        const u = get<{ role: string; active: number }>(db, "SELECT role, active FROM users WHERE id = ?", next);
        if (!u || !u.active || u.role === "viewer") throw badRequest("閲覧者以外の有効なユーザーを指定してください。");
      }
      const name = (id: number | null) => (id ? get<{ name: string }>(db, "SELECT name FROM users WHERE id = ?", id)?.name : null) ?? "未設定";
      changes["担当者"] = { before: name(task.assignee_id), after: name(next) };
      assignee = next;
    }
  }
  if (input.due_date !== undefined) {
    const next = str(input.due_date);
    if (next !== null && !isDate(next)) throw badRequest("期限の日付形式が正しくありません。");
    if (next !== task.due_date) {
      if (!canPrepare(actor, hire)) throw forbidden("期限を変更する権限がありません。");
      changes["期限"] = { before: task.due_date, after: next };
      due = next;
    }
  }
  if (Object.keys(changes).length === 0) return;
  tx(db, () => {
    run(db, "UPDATE hire_tasks SET assignee_id = ?, due_date = ?, updated_at = ? WHERE id = ?", assignee, due, nowIso(), taskId);
    audit(db, actor, "担当者" in changes ? "作業の担当者を変更" : "作業の期限を変更", "task", taskId, task.hire_id, { title: task.title, ...changes });
  });
}

export function getTaskDetail(db: DB, actor: Actor, taskId: number) {
  const task = get<Record<string, unknown>>(
    db,
    `SELECT t.*, u.name AS assignee_name, uc.name AS completed_by_name, ui.name AS iphone_checked_by_name, ua.name AS ipad_checked_by_name,
            tt.version AS template_current_version, tt.updated_at AS template_updated_at, tu.name AS template_updated_by_name
       FROM hire_tasks t
       LEFT JOIN users u ON u.id = t.assignee_id
       LEFT JOIN users uc ON uc.id = t.completed_by
       LEFT JOIN users ui ON ui.id = t.iphone_checked_by
       LEFT JOIN users ua ON ua.id = t.ipad_checked_by
       LEFT JOIN task_templates tt ON tt.id = t.template_id
       LEFT JOIN users tu ON tu.id = tt.updated_by
      WHERE t.id = ?`,
    taskId,
  );
  if (!task) throw notFound("作業が見つかりません。");
  const hireRef = assertViewHire(db, actor, task.hire_id as number);
  const hire = get<Record<string, unknown>>(
    db,
    `SELECT h.id, h.name, h.name_romaji, h.start_date, h.status, d.name AS department_name, o.name AS office_name
       FROM hires h JOIN departments d ON d.id = h.department_id LEFT JOIN offices o ON o.id = h.office_id WHERE h.id = ?`,
    task.hire_id,
  );
  const prereqCodes: string[] = JSON.parse((task.prerequisites as string) || "[]");
  const prerequisites = prereqCodes.length
    ? all(db, `SELECT id, title, status FROM hire_tasks WHERE hire_id = ? AND template_code IN (${prereqCodes.map(() => "?").join(",")}) ORDER BY sort_no`, task.hire_id, ...prereqCodes)
    : [];
  const comments = all(
    db,
    "SELECT c.id, c.body, c.created_at, u.name AS user_name FROM task_comments c JOIN users u ON u.id = c.user_id WHERE c.task_id = ? ORDER BY c.id",
    taskId,
  );
  const apple = get<Record<string, unknown>>(
    db, "SELECT number, planned_email, actual_email, status FROM apple_numbers WHERE hire_id = ? AND status IN ('reserved','created')", task.hire_id,
  );
  // 関連サービス(URL・使用アカウント)
  const services = all<Record<string, unknown>>(
    db,
    `SELECT s.id, s.name, s.placement, s.placement_confirmed, s.url, s.app_store_url, s.account_type, s.account_note,
            hs.requirement, hs.usage_decision ${canViewCredentials(actor, hireRef) ? ", s.credential_ref" : ""}
       FROM hire_services hs JOIN services s ON s.id = hs.service_id WHERE hs.hire_id = ? ORDER BY s.sort`,
    task.hire_id,
  );
  const history = all(
    db, "SELECT at, user_name, action, detail FROM audit_logs WHERE entity = 'task' AND entity_id = ? ORDER BY id DESC", taskId,
  );
  const problems = task.status === "done" || task.status === "na" ? [] : completionProblems(db, task as unknown as TaskRow);
  return {
    task, hire, prerequisites, comments, apple, services, history, problems,
    companyGoogle: getSetting(db, "company_google_account"),
    credentialStore: getSetting(db, "credential_store_name"),
    wifiName: getSetting(db, "company_wifi_name"),
    namingRule: getSetting(db, "device_naming_rule"),
    perms: {
      canUpdate: canUpdateTask(actor, loadHireRef(db, task.hire_id as number), task as never),
      canAdmin: actor.role === "admin",
      canEditDue: canPrepare(actor, hireRef),
    },
  };
}
