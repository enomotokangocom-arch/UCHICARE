import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/crm/prisma";
import { requireSession, apiErrorResponse } from "@/lib/crm/session";
import { hashPassword } from "@/lib/crm/auth";
import { writeAuditLog, getClientIp } from "@/lib/crm/audit";

// スタッフ一覧は担当者アサインのドロップダウン等で全ロールから参照されるため、
// 閲覧のみ requireSession() (書き込みはADMIN限定)。
export async function GET() {
  try {
    await requireSession();
    const staff = await prisma.staffUser.findMany({
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ staff });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  password: z.string().min(8).max(200),
  role: z.enum(["ADMIN", "RECRUITER", "VIEWER"]),
});

export async function POST(request: Request) {
  try {
    const session = await requireSession({ requireAdmin: true });
    const json = await request.json().catch(() => null);
    const parsed = createSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "入力内容が不正です(パスワードは8文字以上)。" }, { status: 400 });
    }

    const existing = await prisma.staffUser.findUnique({ where: { email: parsed.data.email } });
    if (existing) {
      return NextResponse.json({ error: "このメールアドレスは既に登録されています。" }, { status: 409 });
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const staff = await prisma.staffUser.create({
      data: { email: parsed.data.email, name: parsed.data.name, role: parsed.data.role, passwordHash },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });

    await writeAuditLog({
      staffId: session.staffId,
      action: "STAFF_CREATE",
      targetType: "StaffUser",
      targetId: staff.id,
      ip: getClientIp(request),
    });

    return NextResponse.json({ staff });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
