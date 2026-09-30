import { get } from "@/onboarding/server/db";
import { getSetting } from "@/onboarding/server/core";
import { db, errorResponse } from "@/onboarding/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ログイン前に表示する情報(ユーザー未登録か、デモモードか)。個人情報は返さない。 */
export async function GET() {
  try {
    const d = db();
    return Response.json({ needsInit: !get(d, "SELECT 1 FROM users LIMIT 1"), demo: getSetting(d, "mode") === "demo" });
  } catch (e) {
    return errorResponse(e);
  }
}
