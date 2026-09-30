import { DB, all, get, nowIso, run, tx } from "./db";
import { Actor, assertNoSecret, audit, badRequest, conflict, forbidden, getSetting, notFound, requireRole, str } from "./core";
import { assertPrepare, assertViewHire } from "./authz";
import { pad3 } from "../shared/labels";

/**
 * Appleアカウント番号の管理。
 *
 * - 「番号予約」はツール上で番号とメールアドレスを確保する操作です。
 * - 「アカウント作成」はApple側で人が行う作業で、終わったら「作成済みとして記録」します。
 * - 番号は 発行済みの最新番号(初期値36)と登録済みの最大番号 の大きい方 + 1 を採番します。
 *   取消・使用不可の番号も最大番号に含めるため、自動では再利用されません(再利用は管理者の承認が必要)。
 * - 採番は BEGIN IMMEDIATE のトランザクション内で行い、さらに番号・メールに UNIQUE 制約があるため、
 *   複数人が同時に予約しても重複しません。
 */

export function plannedEmail(db: DB, n: number): string {
  const prefix = getSetting(db, "apple_prefix") ?? "uchicare";
  const domain = getSetting(db, "apple_domain") ?? "icloud.com";
  return `${prefix}${pad3(n)}@${domain}`;
}

export function nextNumber(db: DB): number {
  const lastIssued = Number(getSetting(db, "apple_last_issued") ?? "0");
  const maxRow = get<{ m: number | null }>(db, "SELECT MAX(number) AS m FROM apple_numbers");
  return Math.max(lastIssued, maxRow?.m ?? 0) + 1;
}

function activeForHire(db: DB, hireId: number) {
  return get<{ id: number; number: number }>(
    db, "SELECT id, number FROM apple_numbers WHERE hire_id = ? AND status IN ('reserved','created')", hireId,
  );
}

export function reserveNext(db: DB, actor: Actor, hireId: number) {
  assertPrepare(db, actor, hireId);
  return tx(db, () => {
    const existing = activeForHire(db, hireId);
    if (existing) throw conflict(`この入職者には既に番号 ${pad3(existing.number)} が割り当てられています。`);
    const n = nextNumber(db);
    const email = plannedEmail(db, n);
    if (get(db, "SELECT 1 FROM apple_numbers WHERE planned_email = ? OR actual_email = ?", email, email)) {
      throw conflict(`メールアドレス ${email} は既に登録されています。管理者に確認してください。`);
    }
    const r = run(
      db,
      "INSERT INTO apple_numbers (number, planned_email, status, hire_id, reserved_by, reserved_at) VALUES (?,?, 'reserved', ?,?,?)",
      n, email, hireId, actor.id, nowIso(),
    );
    const id = Number(r.lastInsertRowid);
    audit(db, actor, "Apple番号を予約", "apple", id, hireId, { number: pad3(n), planned_email: email });
    return { id, number: n, planned_email: email };
  });
}

function loadNumber(db: DB, id: number) {
  const a = get<{ id: number; number: number; planned_email: string; actual_email: string | null; status: string; hire_id: number | null }>(
    db, "SELECT * FROM apple_numbers WHERE id = ?", id,
  );
  if (!a) throw notFound("Apple番号が見つかりません。");
  return a;
}

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

/** Apple側でアカウントを作成できたことを記録し、メールアドレスを確定させる */
export function recordCreated(db: DB, actor: Actor, id: number, actualEmail: unknown, note?: unknown) {
  const a = loadNumber(db, id);
  if (!a.hire_id) throw badRequest("入職者に割り当てられていない番号です。");
  assertPrepare(db, actor, a.hire_id);
  const email = str(actualEmail)?.toLowerCase() ?? null;
  if (!email || !EMAIL_RE.test(email)) throw badRequest("実際に作成したメールアドレスを入力してください。");
  const memo = str(note);
  assertNoSecret(memo, "メモ");
  tx(db, () => {
    const cur = loadNumber(db, id);
    if (cur.status !== "reserved") throw conflict("予約中の番号のみ「作成済み」にできます。");
    const dup = get<{ number: number }>(
      db, "SELECT number FROM apple_numbers WHERE id <> ? AND (planned_email = ? OR actual_email = ?)", id, email, email,
    );
    if (dup) throw conflict(`メールアドレス ${email} は番号 ${pad3(dup.number)} で既に使われています。`);
    if (email !== cur.planned_email && !memo) {
      throw badRequest("予定メールと異なるアドレスで作成した場合は、理由をメモに記録してください。");
    }
    run(
      db,
      "UPDATE apple_numbers SET status = 'created', actual_email = ?, created_recorded_by = ?, created_recorded_at = ?, note = COALESCE(?, note) WHERE id = ?",
      email, actor.id, nowIso(), memo, id,
    );
    // 端末台帳: この入職者の端末でApple Accountが未設定なら、同じアカウントを初期値として割り当てる
    run(db, "UPDATE devices SET apple_number_id = ? WHERE hire_id = ? AND apple_number_id IS NULL", id, cur.hire_id);
    audit(db, actor, "Appleアカウント作成済みを記録", "apple", id, cur.hire_id, { number: pad3(cur.number), actual_email: email, note: memo });
  });
}

/** Apple側で作成できなかった場合。理由を必ず記録し、番号は「使用不可」または「取消」にする */
export function recordFailed(db: DB, actor: Actor, id: number, reason: unknown, mark: unknown = "unusable") {
  const a = loadNumber(db, id);
  if (!a.hire_id) throw badRequest("入職者に割り当てられていない番号です。");
  assertPrepare(db, actor, a.hire_id);
  const r = str(reason);
  if (!r) throw badRequest("作成できなかった理由を入力してください。");
  assertNoSecret(r, "理由");
  const status = mark === "cancelled" ? "cancelled" : "unusable";
  tx(db, () => {
    const cur = loadNumber(db, id);
    if (cur.status !== "reserved") throw conflict("予約中の番号のみ記録できます。");
    run(
      db,
      "UPDATE apple_numbers SET status = ?, failure_reason = ?, cancelled_by = ?, cancelled_at = ? WHERE id = ?",
      status, r, actor.id, nowIso(), id,
    );
    audit(db, actor, "Apple側で作成できなかったことを記録", "apple", id, cur.hire_id, { number: pad3(cur.number), reason: r, status });
  });
}

/** 予約の取消。作成済みの取消は管理者のみ。 */
export function cancelNumber(db: DB, actor: Actor, id: number, reason: unknown) {
  const a = loadNumber(db, id);
  if (a.hire_id) assertPrepare(db, actor, a.hire_id);
  else requireRole(actor, "admin");
  if (a.status === "created" && actor.role !== "admin") throw forbidden("作成済みの番号の取消は管理者のみ行えます。");
  const r = str(reason);
  if (!r) throw badRequest("取消の理由を入力してください。");
  assertNoSecret(r, "理由");
  tx(db, () => {
    const cur = loadNumber(db, id);
    if (cur.status !== "reserved" && cur.status !== "created") throw conflict("この番号は取消できる状態ではありません。");
    run(db, "UPDATE apple_numbers SET status = 'cancelled', cancel_reason = ?, cancelled_by = ?, cancelled_at = ? WHERE id = ?", r, actor.id, nowIso(), id);
    run(db, "UPDATE devices SET apple_number_id = NULL WHERE apple_number_id = ?", id);
    audit(db, actor, "Apple番号を取消", "apple", id, cur.hire_id, { number: pad3(cur.number), reason: r });
  });
}

export function markUnusable(db: DB, actor: Actor, id: number, reason: unknown) {
  requireRole(actor, "admin");
  const r = str(reason);
  if (!r) throw badRequest("使用不可にする理由を入力してください。");
  tx(db, () => {
    const cur = loadNumber(db, id);
    if (cur.status !== "cancelled") throw conflict("取消済みの番号のみ使用不可にできます。");
    run(db, "UPDATE apple_numbers SET status = 'unusable', failure_reason = COALESCE(failure_reason, ?) WHERE id = ?", r, id);
    audit(db, actor, "Apple番号を使用不可に変更", "apple", id, cur.hire_id, { number: pad3(cur.number), reason: r });
  });
}

/** 取消番号の再利用。管理者が確認したうえで、指定した入職者に割り当て直す。 */
export function approveReuse(db: DB, actor: Actor, id: number, hireId: number, note: unknown) {
  requireRole(actor, "admin");
  assertViewHire(db, actor, hireId);
  const n = str(note);
  if (!n) throw badRequest("再利用を判断した理由(Apple側で未作成であることの確認等)を入力してください。");
  assertNoSecret(n, "理由");
  return tx(db, () => {
    const cur = loadNumber(db, id);
    if (cur.status !== "cancelled") throw conflict("取消状態の番号のみ再利用できます(使用不可の番号は再利用できません)。");
    if (cur.actual_email) throw conflict("Apple側で作成済みだった番号は再利用できません。");
    const existing = activeForHire(db, hireId);
    if (existing) throw conflict(`この入職者には既に番号 ${pad3(existing.number)} が割り当てられています。`);
    const prevHire = cur.hire_id;
    run(
      db,
      `UPDATE apple_numbers SET status = 'reserved', hire_id = ?, reserved_by = ?, reserved_at = ?,
         reuse_approved_by = ?, reuse_approved_at = ?, note = ? WHERE id = ?`,
      hireId, actor.id, nowIso(), actor.id, nowIso(), n, id,
    );
    audit(db, actor, "取消番号の再利用を承認", "apple", id, hireId, { number: pad3(cur.number), previous_hire_id: prevHire, note: n });
    return { id, number: cur.number };
  });
}

export function listNumbers(db: DB, actor: Actor) {
  if (actor.role !== "admin" && actor.role !== "preparer") throw forbidden();
  return {
    next: nextNumber(db),
    nextEmail: plannedEmail(db, nextNumber(db)),
    lastIssued: Number(getSetting(db, "apple_last_issued") ?? "0"),
    rows: all(
      db,
      `SELECT a.*, h.name AS hire_name, u.name AS reserved_by_name, ra.name AS reuse_approved_by_name
         FROM apple_numbers a LEFT JOIN hires h ON h.id = a.hire_id LEFT JOIN users u ON u.id = a.reserved_by
         LEFT JOIN users ra ON ra.id = a.reuse_approved_by
        ORDER BY a.number DESC`,
    ),
  };
}
