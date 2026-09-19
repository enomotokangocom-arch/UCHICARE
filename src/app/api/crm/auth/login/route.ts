import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/crm/prisma";
import { verifyPassword } from "@/lib/crm/auth";
import { setSessionCookie } from "@/lib/crm/session";
import { writeAuditLog } from "@/lib/crm/audit";
import { rateLimit, getRequestIp } from "@/lib/crm/rateLimit";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const ip = getRequestIp(request);
  const limit = rateLimit(`login:${ip}`, 10, 5 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "ログイン試行回数が多すぎます。しばらく待ってから再度お試しください。" },
      { status: 429 }
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "メールアドレスとパスワードを入力してください。" }, { status: 400 });
  }

  const { email, password } = parsed.data;
  const staff = await prisma.staffUser.findUnique({ where: { email } });

  if (!staff || !staff.isActive) {
    return NextResponse.json({ error: "メールアドレスまたはパスワードが正しくありません。" }, { status: 401 });
  }

  const valid = await verifyPassword(password, staff.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "メールアドレスまたはパスワードが正しくありません。" }, { status: 401 });
  }

  await setSessionCookie({ staffId: staff.id, email: staff.email, name: staff.name, role: staff.role });
  await writeAuditLog({ staffId: staff.id, action: "LOGIN", targetType: "StaffUser", targetId: staff.id, ip });

  return NextResponse.json({ ok: true, name: staff.name, role: staff.role });
}
