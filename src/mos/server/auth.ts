import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import type { Role } from "../domain/types";
import { getDb, requireEnv } from "./db";
import { SESSION_COOKIE, SESSION_HOURS, signSession, verifySession } from "./sessionToken";

export type CurrentUser = { id: string; name: string; email: string; role: Role };

export async function createSession(userId: string, role: Role) {
  const token = await signSession({ userId, role }, requireEnv("MOS_SESSION_SECRET"));
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function deleteSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** セッションを検証し、DB 上で有効なユーザーかどうかも確認する（ロールは DB の値を正とする） */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await verifySession(token, requireEnv("MOS_SESSION_SECRET"));
  if (!session) return null;
  const user = await getDb().user.findUnique({ where: { id: session.userId } });
  if (!user || !user.active) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

/** ページ・Server Action の入口で呼ぶ。未ログインはログイン画面へ、権限外はダッシュボードへ */
export async function requireUser(roles?: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/mos/login");
  if (roles && !roles.includes(user.role)) redirect("/mos?denied=1");
  return user;
}

let DUMMY_HASH: string | undefined;

export async function verifyPassword(email: string, password: string): Promise<CurrentUser | null> {
  const user = await getDb().user.findUnique({ where: { email: email.trim().toLowerCase() } });
  // ユーザーの有無で応答時間が変わらないよう、存在しない場合もハッシュ比較を行う
  const hash = user?.passwordHash ?? (DUMMY_HASH ??= bcrypt.hashSync("dummy-password", 10));
  const ok = await bcrypt.compare(password, hash);
  if (!user || !ok || !user.active) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}
