import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/server/uchi-os/auth/rbac";
import { handleApiError, apiError } from "@/server/uchi-os/http";
import { prisma } from "@/server/uchi-os/db/client";
import { markDecisionReviewed } from "@/server/uchi-os/decision-engine/decision-status";

const statusSchema = z.object({ status: z.enum(["IN_PROGRESS", "COMPLETED"]) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const body = statusSchema.parse(await request.json());

    const action = await prisma.action.findFirst({ where: { id, organizationId: session.organizationId } });
    if (!action) return apiError("NOT_FOUND", "Actionが見つかりません", 404);
    if (action.status !== "HUMAN_APPROVED" && body.status === "IN_PROGRESS") {
      return apiError("INVALID_STATE", "承認済みのActionのみ着手できます", 409);
    }
    if (action.status !== "IN_PROGRESS" && body.status === "COMPLETED") {
      return apiError("INVALID_STATE", "着手中のActionのみ完了にできます", 409);
    }

    const updated = await prisma.action.update({ where: { id }, data: { status: body.status } });
    await markDecisionReviewed(action.decisionId);

    await prisma.auditLog.create({
      data: {
        organizationId: session.organizationId,
        userId: session.userId,
        action: "action.status_update",
        targetType: "Action",
        targetId: id,
        metadata: { status: body.status },
      },
    });

    return NextResponse.json({ action: updated });
  } catch (error) {
    if (error instanceof z.ZodError) return apiError("VALIDATION_ERROR", "入力内容を確認してください", 400);
    return handleApiError(error);
  }
}
