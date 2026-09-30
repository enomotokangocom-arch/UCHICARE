import { DB, all, get, nowIso, run, tx } from "./db";
import { Actor, assertNoSecret, audit, badRequest, conflict, diffFields, forbidden, intOrNull, isDate, notFound, str } from "./core";
import { canViewCredentials, loadHireRef, canPrepare } from "./authz";
import { LEND_STATUS_LABELS } from "../shared/labels";

/**
 * 端末台帳。
 * 同一職員のiPhone・iPadには同じ会社用Apple Accountを割り当てるのが初期案です。
 * 端末を入職者に割り当てたとき、Apple Accountが未指定ならその入職者の番号を初期値にします(後から変更可)。
 * 端末パスコードは保存せず、保管場所(passcode_ref)だけを記録します。
 */

function assertDeviceEditor(db: DB, actor: Actor, hireId: number | null) {
  if (actor.role === "admin") return;
  if (actor.role !== "preparer") throw forbidden("端末台帳を編集する権限がありません。");
  if (hireId !== null && !canPrepare(actor, loadHireRef(db, hireId))) {
    throw forbidden("担当していない入職者に端末を割り当てることはできません。");
  }
}

export function listDevices(db: DB, actor: Actor) {
  if (actor.role !== "admin" && actor.role !== "preparer") throw forbidden("端末台帳を閲覧する権限がありません。");
  const rows = all<Record<string, unknown>>(
    db,
    `SELECT dv.*, h.name AS hire_name, h.preparer_id, h.deputy_id, h.checker_id, o.name AS office_name,
            COALESCE(a.actual_email, a.planned_email) AS apple_email, a.status AS apple_status, a.number AS apple_number,
            um.name AS auth_manager_name
       FROM devices dv LEFT JOIN hires h ON h.id = dv.hire_id
       LEFT JOIN offices o ON o.id = COALESCE(dv.office_id, h.office_id)
       LEFT JOIN apple_numbers a ON a.id = dv.apple_number_id
       LEFT JOIN users um ON um.id = dv.auth_manager_id
      ORDER BY dv.kind DESC, dv.asset_no`,
  );
  // 端末パスコードの参照先は、管理者と、その入職者の準備担当者のみ
  return rows.map((r) => {
    const ok = actor.role === "admin" ||
      (r.hire_id !== null && canViewCredentials(actor, {
        id: r.hire_id as number, office_id: null, preparer_id: r.preparer_id as number | null,
        deputy_id: r.deputy_id as number | null, checker_id: r.checker_id as number | null,
      }));
    const { passcode_ref, ...rest } = r;
    return ok ? { ...rest, passcode_ref } : rest;
  });
}

const FIELDS = ["asset_no", "kind", "model", "serial", "phone_number", "hire_id", "office_id", "apple_number_id",
  "auth_code_destination", "auth_manager_id", "lend_status", "lent_date", "passcode_ref", "note"] as const;

function normalize(db: DB, input: Record<string, unknown>) {
  const d = {
    asset_no: str(input.asset_no),
    kind: str(input.kind),
    model: str(input.model),
    serial: str(input.serial),
    phone_number: str(input.phone_number),
    hire_id: intOrNull(input.hire_id),
    office_id: intOrNull(input.office_id),
    apple_number_id: intOrNull(input.apple_number_id),
    auth_code_destination: str(input.auth_code_destination),
    auth_manager_id: intOrNull(input.auth_manager_id),
    lend_status: str(input.lend_status) ?? "stock",
    lent_date: str(input.lent_date),
    passcode_ref: str(input.passcode_ref),
    note: str(input.note),
  };
  if (!d.asset_no) throw badRequest("管理番号を入力してください。");
  if (d.kind !== "iPhone" && d.kind !== "iPad") throw badRequest("端末種別を選択してください。");
  if (!(d.lend_status in LEND_STATUS_LABELS)) throw badRequest("貸与状況が正しくありません。");
  if (d.lent_date && !isDate(d.lent_date)) throw badRequest("貸与日の形式が正しくありません。");
  if (d.kind === "iPad" && d.phone_number) throw badRequest("電話番号はiPhoneのみ登録できます。");
  for (const f of ["note", "passcode_ref", "auth_code_destination"] as const) assertNoSecret(d[f], "入力内容");
  if (d.hire_id !== null) {
    if (!get(db, "SELECT 1 FROM hires WHERE id = ?", d.hire_id)) throw badRequest("利用者が見つかりません。");
    if (d.lend_status === "stock") d.lend_status = "assigned";
    if (d.apple_number_id === null) {
      const a = get<{ id: number }>(db, "SELECT id FROM apple_numbers WHERE hire_id = ? AND status IN ('reserved','created')", d.hire_id);
      d.apple_number_id = a?.id ?? null;
    }
  }
  if (d.apple_number_id !== null && !get(db, "SELECT 1 FROM apple_numbers WHERE id = ? AND status IN ('reserved','created')", d.apple_number_id)) {
    throw badRequest("指定したApple Accountは取消・使用不可のため割り当てられません。");
  }
  return d;
}

function uniqueError(e: unknown): never {
  const msg = String((e as Error).message);
  if (msg.includes("devices.asset_no")) throw conflict("この管理番号は既に登録されています。");
  if (msg.includes("devices.serial")) throw conflict("このシリアル番号は既に登録されています。");
  throw e;
}

export function createDevice(db: DB, actor: Actor, input: Record<string, unknown>) {
  const d = normalize(db, input);
  assertDeviceEditor(db, actor, d.hire_id);
  try {
    return tx(db, () => {
      const r = run(
        db,
        `INSERT INTO devices (${FIELDS.join(",")}, updated_at) VALUES (${FIELDS.map(() => "?").join(",")}, ?)`,
        ...FIELDS.map((f) => d[f]), nowIso(),
      );
      const id = Number(r.lastInsertRowid);
      const { passcode_ref, ...logged } = d;
      audit(db, actor, "端末を台帳に登録", "device", id, d.hire_id, { ...logged, passcode_ref: passcode_ref ? "(登録あり)" : null });
      return id;
    });
  } catch (e) {
    uniqueError(e);
  }
}

export function updateDevice(db: DB, actor: Actor, id: number, input: Record<string, unknown>) {
  const before = get<Record<string, unknown>>(db, "SELECT * FROM devices WHERE id = ?", id);
  if (!before) throw notFound("端末が見つかりません。");
  assertDeviceEditor(db, actor, before.hire_id as number | null);
  // 参照先を閲覧できない利用者の更新では、参照先を変更しない(非表示の値を空で上書きしないため)
  if (actor.role !== "admin") {
    const hid = before.hire_id as number | null;
    if (hid === null || !canViewCredentials(actor, loadHireRef(db, hid))) {
      input = { ...input };
      delete input.passcode_ref;
    }
  }
  const d = normalize(db, { ...before, ...input });
  assertDeviceEditor(db, actor, d.hire_id);
  const changes = diffFields(before, d);
  if ("passcode_ref" in changes) changes.passcode_ref = { before: "(非表示)", after: "(変更あり)" };
  if (Object.keys(changes).length === 0) return;
  try {
    tx(db, () => {
      run(db, `UPDATE devices SET ${FIELDS.map((f) => `${f} = ?`).join(", ")}, updated_at = ? WHERE id = ?`, ...FIELDS.map((f) => d[f]), nowIso(), id);
      audit(db, actor, "端末台帳を更新", "device", id, d.hire_id ?? (before.hire_id as number | null), changes);
    });
  } catch (e) {
    uniqueError(e);
  }
}
