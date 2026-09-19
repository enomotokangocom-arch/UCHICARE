import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/server/uchi-os/http";
import { sendDailyDigestForAllOrganizations } from "@/server/uchi-os/notifications/daily-digest";

/**
 * 23章 通知・自動化: 外部スケジューラ(cron)から日次で叩かれる想定の内部エンドポイント。
 * ユーザーセッションではなく共有シークレット(CRON_SECRET)で認証する。
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return apiError("NOT_CONFIGURED", "CRON_SECRET is not configured", 501);
  }
  if (request.headers.get("x-cron-secret") !== secret) {
    return apiError("UNAUTHORIZED", "invalid cron secret", 401);
  }

  const results = await sendDailyDigestForAllOrganizations();
  return NextResponse.json({ results });
}
