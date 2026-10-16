// Uchi Management OS（/mos）の楽観的な認証チェック。
// 本チェック（DB 上の有効ユーザー・ロール）は各ページ・Server Action・Route Handler の requireUser で行う。
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/mos/server/sessionToken";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/mos/login") return NextResponse.next();
  const secret = process.env.MOS_SESSION_SECRET ?? "";
  const session = secret ? await verifySession(request.cookies.get(SESSION_COOKIE)?.value, secret) : null;
  if (!session) {
    const url = new URL("/mos/login", request.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/mos", "/mos/:path*"],
};
