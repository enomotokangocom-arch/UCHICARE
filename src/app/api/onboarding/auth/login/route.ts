import { cookies } from "next/headers";
import { login, SESSION_COOKIE } from "@/onboarding/server/auth";
import { audit } from "@/onboarding/server/core";
import { db, errorResponse, readJson } from "@/onboarding/server/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const { token, actor, expires } = login(db(), body.login_id, body.password);
    audit(db(), actor, "ログイン", "user", actor.id, null);
    const store = await cookies();
    store.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production" && process.env.ONBOARDING_INSECURE_COOKIE !== "1",
      path: "/",
      expires,
    });
    return Response.json({ actor });
  } catch (e) {
    return errorResponse(e);
  }
}
