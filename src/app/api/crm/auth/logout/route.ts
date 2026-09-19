import { NextResponse } from "next/server";
import { getSession, clearSessionCookie } from "@/lib/crm/session";
import { writeAuditLog } from "@/lib/crm/audit";
import { getClientIp } from "@/lib/crm/audit";

export async function POST(request: Request) {
  const session = await getSession();
  await clearSessionCookie();
  if (session) {
    await writeAuditLog({
      staffId: session.staffId,
      action: "LOGOUT",
      targetType: "StaffUser",
      targetId: session.staffId,
      ip: getClientIp(request),
    });
  }
  return NextResponse.json({ ok: true });
}
