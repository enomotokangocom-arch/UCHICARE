import { DB, get } from "./db";
import { Actor, forbidden, notFound } from "./core";

/**
 * アクセス権限の判定(サーバー側)。画面の表示制御とは別に、すべてのAPIでこの判定を通します。
 *
 * - 管理者       : すべて
 * - 準備担当者   : 自分が準備担当・代行担当・確認管理者の入職者の閲覧と準備作業
 * - 事務・発行責任者: 自分が発行担当(または代行)のサービスがある入職者、自分に割り当てられた作業のある入職者の閲覧と、
 *                   該当サービスの発行状況・自分の作業の更新
 * - 閲覧者       : 許可された事業所の入職者の進捗閲覧のみ
 */

export interface HireRef {
  id: number;
  office_id: number | null;
  preparer_id: number | null;
  deputy_id: number | null;
  checker_id: number | null;
}

export function loadHireRef(db: DB, hireId: number): HireRef {
  const h = get<HireRef>(
    db,
    "SELECT id, office_id, preparer_id, deputy_id, checker_id FROM hires WHERE id = ? AND archived = 0",
    hireId,
  );
  if (!h) throw notFound("入職者が見つかりません。");
  return h;
}

export function isPreparerOf(actor: Actor, hire: HireRef): boolean {
  return actor.role === "preparer" && (hire.preparer_id === actor.id || hire.deputy_id === actor.id);
}

function issuerRelated(db: DB, actor: Actor, hireId: number): boolean {
  const r = get(
    db,
    `SELECT 1 FROM account_requests ar JOIN services s ON s.id = ar.service_id
      WHERE ar.hire_id = ? AND (s.issuer_user_id = ? OR s.deputy_user_id = ?) LIMIT 1`,
    hireId, actor.id, actor.id,
  );
  if (r) return true;
  return !!get(db, "SELECT 1 FROM hire_tasks WHERE hire_id = ? AND assignee_id = ? LIMIT 1", hireId, actor.id);
}

export function canViewHire(db: DB, actor: Actor, hire: HireRef): boolean {
  switch (actor.role) {
    case "admin":
      return true;
    case "preparer":
      return isPreparerOf(actor, hire) || hire.checker_id === actor.id ||
        !!get(db, "SELECT 1 FROM hire_tasks WHERE hire_id = ? AND assignee_id = ? LIMIT 1", hire.id, actor.id);
    case "issuer":
      return issuerRelated(db, actor, hire.id);
    case "viewer":
      return hire.office_id !== null && actor.scope_office_ids.includes(hire.office_id);
  }
}

export function assertViewHire(db: DB, actor: Actor, hireId: number): HireRef {
  const hire = loadHireRef(db, hireId);
  if (!canViewHire(db, actor, hire)) throw forbidden("この入職者の情報を閲覧する権限がありません。");
  return hire;
}

/** 入職者の準備作業(端末・Apple番号・依頼記録など)を行えるか */
export function canPrepare(actor: Actor, hire: HireRef): boolean {
  return actor.role === "admin" || isPreparerOf(actor, hire);
}

export function assertPrepare(db: DB, actor: Actor, hireId: number): HireRef {
  const hire = assertViewHire(db, actor, hireId);
  if (!canPrepare(actor, hire)) throw forbidden("この入職者の準備作業を行う権限がありません。");
  return hire;
}

/** 認証情報の参照先を見られるのは、管理者と、その入職者の準備担当者(代行含む)のみ */
export function canViewCredentials(actor: Actor, hire: HireRef): boolean {
  return actor.role === "admin" || isPreparerOf(actor, hire);
}

/** 作業の更新: 管理者、入職者の準備担当者、作業の担当者(閲覧者を除く) */
export function canUpdateTask(actor: Actor, hire: HireRef, task: { assignee_id: number | null }): boolean {
  if (actor.role === "viewer") return false;
  return canPrepare(actor, hire) || task.assignee_id === actor.id;
}

/** 発行状況の更新: 管理者、準備担当者、そのサービスの発行担当者・代行担当者 */
export function canUpdateIssuance(
  actor: Actor,
  hire: HireRef,
  service: { issuer_user_id: number | null; deputy_user_id: number | null },
): boolean {
  if (canPrepare(actor, hire)) return true;
  return actor.role === "issuer" && (service.issuer_user_id === actor.id || service.deputy_user_id === actor.id);
}
