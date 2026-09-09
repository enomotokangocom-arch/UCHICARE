import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/server/uchi-os/auth/rbac";
import { handleApiError, apiError } from "@/server/uchi-os/http";
import { prisma } from "@/server/uchi-os/db/client";
import { markDecisionReviewed } from "@/server/uchi-os/decision-engine/decision-status";

const holdSchema = z.object({ reason: z.string().min(1).max(500) });
const HOLDABLE_FROM = ["DRAFT", "AI_RECOMMENDED", "HUMAN_APPROVED"];

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const body = holdSchema.parse(await request.json());

    const action = await prisma.action.findFirst({ where: { id, organizationId: session.organizationId } });
    if (!action) return apiError("NOT_FOUND", "Actionが見つかりません", 404);
    if (!HOLDABLE_FROM.includes(action.status)) {
      return apiError("INVALID_STATE", `現在のステータス(${action.status})は保留にできません`, 409);
    }

    const updated = await prisma.action.update({
      where: { id },
      data: { status: "HELD", holdReason: body.reason },
    });
    await markDecisionReviewed(action.decisionId);

    await prisma.auditLog.create({
      data: {
        organizationId: session.organizationId,
        userId: session.userId,
        action: "action.hold",
        targetType: "Action",
        targetId: id,
        metadata: { reason: body.reason },
      },
    });

    return NextResponse.json({ action: updated });
  } catch (error) {
    if (error instanceof z.ZodError) return apiError("VALIDATION_ERROR", "保留理由を入力してください", 400);
    return handleApiError(error);
  }
}
