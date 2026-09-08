import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/server/uchi-os/auth/session";

// Uchi OS の画面 (/uchi-os/**) のみを対象とする。既存のUCHICAREアプリの挙動は変更しない。
export const config = {
  matcher: ["/uchi-os/:path*"],
};

const PUBLIC_PATHS = new Set(["/uchi-os/login"]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    const loginUrl = new URL("/uchi-os/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}
