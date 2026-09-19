import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE,
  type SessionPayload,
  type StaffRole,
  createSessionToken,
  verifySessionToken,
  canWrite,
  canManageAdmin,
} from "./auth";

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function setSessionCookie(payload: SessionPayload) {
  const token = await createSessionToken(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}

export class ApiAuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * APIルートハンドラで呼び出す認証・認可チェック。
 * Proxy(旧middleware)はUIリダイレクト用の一次防御であり、
 * 実際のアクセス制御は必ずここで再検証します。
 */
export async function requireSession(options?: {
  requireWrite?: boolean;
  requireAdmin?: boolean;
}): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new ApiAuthError("認証が必要です。再度ログインしてください。", 401);
  }
  if (options?.requireAdmin && !canManageAdmin(session.role)) {
    throw new ApiAuthError("この操作には管理者権限が必要です。", 403);
  }
  if (options?.requireWrite && !canWrite(session.role)) {
    throw new ApiAuthError("この操作には編集権限が必要です(閲覧のみのアカウントです)。", 403);
  }
  return session;
}

export function apiErrorResponse(error: unknown) {
  if (error instanceof ApiAuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ error: "予期しないエラーが発生しました。" }, { status: 500 });
}

export type { StaffRole };
