import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/server/uchi-os/auth/rbac";
import { handleApiError, apiError } from "@/server/uchi-os/http";
import { prisma } from "@/server/uchi-os/db/client";

const patchSchema = z.object({ status: z.literal("DISMISSED") });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const body = patchSchema.parse(await request.json());

    const decision = await prisma.decision.findFirst({ where: { id, organizationId: session.organizationId } });
    if (!decision) return apiError("NOT_FOUND", "Decisionが見つかりません", 404);

    const updated = await prisma.decision.update({ where: { id }, data: { status: body.status } });

    await prisma.auditLog.create({
      data: {
        organizationId: session.organizationId,
        userId: session.userId,
        action: "decision.dismiss",
        targetType: "Decision",
        targetId: id,
      },
    });

    return NextResponse.json({ decision: updated });
  } catch (error) {
    if (error instanceof z.ZodError) return apiError("VALIDATION_ERROR", "入力内容を確認してください", 400);
    return handleApiError(error);
  }
}
