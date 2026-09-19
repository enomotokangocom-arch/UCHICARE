import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/crm/prisma";
import { requireSession, apiErrorResponse } from "@/lib/crm/session";
import { writeAuditLog, getClientIp } from "@/lib/crm/audit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: z.enum(["ADMIN", "RECRUITER", "VIEWER"]).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const session = await requireSession({ requireAdmin: true });
    const { id } = await params;
    const json = await request.json().catch(() => null);
    const parsed = updateSchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: "入力内容が不正です。" }, { status: 400 });

    const staff = await prisma.staffUser.update({
      where: { id },
      data: parsed.data,
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });

    await writeAuditLog({
      staffId: session.staffId,
      action: "STAFF_UPDATE",
      targetType: "StaffUser",
      targetId: id,
      after: staff,
      ip: getClientIp(request),
    });

    return NextResponse.json({ staff });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
