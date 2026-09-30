import { cookies } from "next/headers";
import { getDb, get } from "./db";
import { Actor, AppError } from "./core";
import { actorFromToken, SESSION_COOKIE } from "./auth";
import { seedMaster } from "./seed";

/** Route Handler 共通処理: ログイン確認・エラー応答 */

export function db() {
  const d = getDb();
  seedMaster(d);
  return d;
}

export async function currentActor(): Promise<Actor | null> {
  const store = await cookies();
  return actorFromToken(db(), store.get(SESSION_COOKIE)?.value);
}

export function errorResponse(e: unknown) {
  if (e instanceof AppError) {
    return Response.json({ error: e.message }, { status: e.status });
  }
  console.error("[onboarding] unexpected error", e instanceof Error ? e.message : e);
  return Response.json({ error: "サーバーでエラーが発生しました。時間をおいて再度お試しください。" }, { status: 500 });
}

export async function withActor(fn: (actor: Actor) => unknown | Promise<unknown>) {
  try {
    const actor = await currentActor();
    if (!actor) {
      const needsInit = !get(db(), "SELECT 1 FROM users LIMIT 1");
      return Response.json({ error: "ログインしてください。", needsInit }, { status: 401 });
    }
    const result = await fn(actor);
    return Response.json(result ?? { ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

/** 変更系リクエストは JSON のみ受け付ける(他サイトからのフォーム送信による不正操作を防ぐ) */
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  if (!(request.headers.get("content-type") ?? "").includes("application/json")) {
    throw new AppError(415, "JSON形式で送信してください。");
  }
  try {
    const body = await request.json();
    return body && typeof body === "object" ? body : {};
  } catch {
    throw new AppError(400, "送信内容を読み取れませんでした。");
  }
}
