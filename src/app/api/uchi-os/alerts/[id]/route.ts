import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/server/uchi-os/auth/rbac";
import { handleApiError, apiError } from "@/server/uchi-os/http";
import { prisma } from "@/server/uchi-os/db/client";

const patchSchema = z.object({ status: z.enum(["ACKNOWLEDGED", "RESOLVED", "DISMISSED"]) });

// 10.5節: Alert一覧のステータス変更(Acknowledge/Resolve/Dismiss)。
// RESOLVEDへの自動遷移はAlert Engine(decision-engine/generate.ts)が条件解消時に行うが、
// ここでは人間が明示的に確認・保留・却下する操作を扱う。
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const body = patchSchema.parse(await request.json());

    const alert = await prisma.alert.findFirst({ where: { id, organizationId: session.organizationId } });
    if (!alert) return apiError("NOT_FOUND", "Alertが見つかりません", 404);

    const updated = await prisma.alert.update({ where: { id }, data: { status: body.status } });

    await prisma.auditLog.create({
      data: {
        organizationId: session.organizationId,
        userId: session.userId,
        action: "alert.status_update",
        targetType: "Alert",
        targetId: id,
        metadata: { status: body.status },
      },
    });

    return NextResponse.json({ alert: updated });
  } catch (error) {
    if (error instanceof z.ZodError) return apiError("VALIDATION_ERROR", "入力内容を確認してください", 400);
    return handleApiError(error);
  }
}
