import { cookies } from "next/headers";
import { logout, SESSION_COOKIE } from "@/onboarding/server/auth";
import { db } from "@/onboarding/server/http";

export const runtime = "nodejs";

export async function POST() {
  const store = await cookies();
  logout(db(), store.get(SESSION_COOKIE)?.value);
  store.delete(SESSION_COOKIE);
  return Response.json({ ok: true });
}
