import crypto from "node:crypto";
import { DB, all, get, nowIso, run } from "./db";
import type { Role } from "../shared/labels";

export class AppError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
export const forbidden = (msg = "この操作を行う権限がありません。") => new AppError(403, msg);
export const badRequest = (msg: string) => new AppError(400, msg);
export const notFound = (msg = "対象が見つかりません。") => new AppError(404, msg);
export const conflict = (msg: string) => new AppError(409, msg);

export interface Actor {
  id: number;
  name: string;
  login_id: string;
  role: Role;
  is_representative: boolean;
  scope_office_ids: number[];
}

export function loadActor(db: DB, userId: number): Actor | null {
  const u = get<{
    id: number; name: string; login_id: string; role: Role; is_representative: number;
    scope_office_ids: string; active: number;
  }>(db, "SELECT * FROM users WHERE id = ?", userId);
  if (!u || !u.active) return null;
  return {
    id: u.id,
    name: u.name,
    login_id: u.login_id,
    role: u.role,
    is_representative: !!u.is_representative,
    scope_office_ids: JSON.parse(u.scope_office_ids || "[]"),
  };
}

// ---------- パスワード(ツールへのログイン用。業務サービスのパスワードは扱わない) ----------

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 32).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const calc = crypto.scryptSync(password, salt, 32);
  const expected = Buffer.from(hash, "hex");
  return expected.length === calc.length && crypto.timingSafeEqual(calc, expected);
}

// ---------- 変更履歴 ----------

export function audit(
  db: DB,
  actor: Actor | null,
  action: string,
  entity: string,
  entityId: number | null,
  hireId: number | null,
  detail?: unknown,
) {
  run(
    db,
    "INSERT INTO audit_logs (at, user_id, user_name, action, entity, entity_id, hire_id, detail) VALUES (?,?,?,?,?,?,?,?)",
    nowIso(),
    actor?.id ?? null,
    actor?.name ?? "システム",
    action,
    entity,
    entityId,
    hireId,
    detail === undefined ? null : JSON.stringify(detail),
  );
}

/** 変更前後を比較し、変わった項目だけを { 項目: {before, after} } で返す */
export function diffFields(before: Record<string, unknown>, after: Record<string, unknown>) {
  const changes: Record<string, { before: unknown; after: unknown }> = {};
  for (const key of Object.keys(after)) {
    const b = before[key] ?? null;
    const a = after[key] ?? null;
    if (String(b) !== String(a)) changes[key] = { before: b, after: a };
  }
  return changes;
}

// ---------- 認証情報の混入防止 ----------

const SECRET_PATTERNS: RegExp[] = [
  // 例: 「PW: abc123」「パスワード=xxxx」「passcode:1234」(「1Password: 保管庫」のような参照先は対象外)
  /(?<![A-Za-z0-9])(password|passwd|pass|pwd|pw|passcode|pin|パスワード|パスコード|暗証番号)\s*[::=＝]\s*\S+/i,
];

/**
 * コメント・備考・参照先などの自由入力欄に、パスワードやパスコードの実値らしき記述が
 * 含まれていないか確認します。含まれる場合は保存を拒否します。
 */
export function assertNoSecret(text: string | null | undefined, field: string) {
  if (!text) return;
  if (SECRET_PATTERNS.some((re) => re.test(text))) {
    throw badRequest(
      `${field}にパスワード・パスコードの値と思われる記述があります。実際の値は入力せず、認証情報管理ツールの「参照先」だけを記録してください。`,
    );
  }
}

export function getSetting(db: DB, key: string): string | null {
  const row = get<{ value: string | null }>(db, "SELECT value FROM settings WHERE key = ?", key);
  return row?.value ?? null;
}

export function getAllSettings(db: DB): Record<string, string | null> {
  const rows = all<{ key: string; value: string | null }>(db, "SELECT key, value FROM settings");
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export function requireRole(actor: Actor, ...roles: Role[]) {
  if (!roles.includes(actor.role)) throw forbidden();
}

export function str(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

export function intOrNull(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  if (!Number.isInteger(n)) throw badRequest("数値の形式が正しくありません。");
  return n;
}

export function isDate(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}
