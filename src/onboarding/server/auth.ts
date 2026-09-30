import crypto from "node:crypto";
import { DB, get, nowIso, run } from "./db";
import { Actor, AppError, loadActor, verifyPassword } from "./core";

export const SESSION_COOKIE = "ob_session";
const SESSION_HOURS = 12;

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** ログイン。成功するとセッショントークン(Cookieに保存)を返す。DBにはトークンのハッシュのみ保存。 */
export function login(db: DB, loginId: unknown, password: unknown): { token: string; actor: Actor; expires: Date } {
  if (typeof loginId !== "string" || typeof password !== "string" || !loginId || !password) {
    throw new AppError(400, "ログインIDとパスワードを入力してください。");
  }
  if (!get(db, "SELECT 1 FROM users LIMIT 1")) {
    throw new AppError(401, "ユーザーがまだ登録されていません。サーバーで npm run onboarding:demo(デモ)または npm run onboarding:init(実データ)を実行してください。");
  }
  const u = get<{ id: number; password_hash: string; active: number }>(db, "SELECT id, password_hash, active FROM users WHERE lower(login_id) = lower(?)", loginId.trim());
  if (!u || !u.active || !verifyPassword(password, u.password_hash)) {
    throw new AppError(401, "ログインIDまたはパスワードが正しくありません。");
  }
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_HOURS * 3600 * 1000);
  run(db, "DELETE FROM sessions WHERE expires_at < ?", nowIso());
  run(db, "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?,?,?,?)", hashToken(token), u.id, nowIso(), expires.toISOString());
  return { token, actor: loadActor(db, u.id)!, expires };
}

export function actorFromToken(db: DB, token: string | undefined | null): Actor | null {
  if (!token) return null;
  const s = get<{ user_id: number; expires_at: string }>(db, "SELECT user_id, expires_at FROM sessions WHERE token_hash = ?", hashToken(token));
  if (!s || s.expires_at < nowIso()) return null;
  return loadActor(db, s.user_id);
}

export function logout(db: DB, token: string | undefined | null) {
  if (token) run(db, "DELETE FROM sessions WHERE token_hash = ?", hashToken(token));
}
