import type { UserRole } from "@prisma/client";
import { getSession, type SessionPayload } from "./session";

export class UnauthorizedError extends Error {
  constructor(message = "ログインが必要です") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "この操作を行う権限がありません") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** API Route Handler用。未ログインなら UnauthorizedError を投げる。 */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new UnauthorizedError();
  return session;
}

/**
 * ロールベースの権限チェック (09章 RBACマトリクスの簡略実装、Phase1は OWNER/ADMIN/STATION_MANAGER を実装)。
 * 許可ロールに含まれなければ ForbiddenError を投げる。
 */
export function assertRole(session: SessionPayload, allowed: UserRole[]): void {
  if (!allowed.includes(session.role)) {
    throw new ForbiddenError();
  }
}

/** STATION_MANAGER は自拠点のデータにしかアクセスできない。それ以外のロールは全拠点アクセス可。 */
export function assertStationAccess(session: SessionPayload, stationId: string | null | undefined): void {
  if (session.role === "STATION_MANAGER" && stationId && session.stationId !== stationId) {
    throw new ForbiddenError("自拠点以外のデータにはアクセスできません");
  }
}

/** 11章の重要判断カテゴリ。承認には OWNER/ADMIN、または該当カテゴリの専門ロールを要求する。 */
export function assertCanApprove(session: SessionPayload, category: string | null): void {
  if (session.role === "OWNER" || session.role === "ADMIN") return;
  if (category === "HIRING" || category === "TERMINATION") {
    if (session.role === "HR") return;
  }
  if (category === "LOAN" || category === "INVESTMENT") {
    if (session.role === "FINANCE") return;
  }
  throw new ForbiddenError("この重要判断を承認する権限がありません");
}
