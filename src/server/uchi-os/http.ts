import { NextResponse } from "next/server";
import { ForbiddenError, UnauthorizedError } from "./auth/rbac";

export function apiError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/** ルートハンドラのcatchブロックで使う共通エラーレスポンス変換。 */
export function handleApiError(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return apiError("UNAUTHORIZED", error.message, 401);
  }
  if (error instanceof ForbiddenError) {
    return apiError("FORBIDDEN", error.message, 403);
  }
  if (error instanceof Error) {
    console.error("[uchi-os] API error:", error);
    return apiError("INTERNAL_ERROR", error.message, 500);
  }
  console.error("[uchi-os] Unknown API error:", error);
  return apiError("INTERNAL_ERROR", "予期しないエラーが発生しました", 500);
}
