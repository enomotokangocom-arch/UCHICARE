import { exportCsv } from "@/onboarding/server/api";
import { currentActor, db, errorResponse } from "@/onboarding/server/http";
import { todayStr } from "@/onboarding/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 進捗一覧CSV(認証情報・参照先は含まない) */
export async function GET() {
  try {
    const actor = await currentActor();
    if (!actor) return Response.json({ error: "ログインしてください。" }, { status: 401 });
    const csv = exportCsv(db(), actor);
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="onboarding-progress-${todayStr()}.csv"`,
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
