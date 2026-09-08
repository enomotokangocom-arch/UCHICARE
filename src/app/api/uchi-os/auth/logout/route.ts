import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/server/uchi-os/auth/session";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
