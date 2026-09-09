import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/server/uchi-os/auth/rbac";
import { handleApiError, apiError } from "@/server/uchi-os/http";
import { prisma } from "@/server/uchi-os/db/client";
import { markDecisionReviewed } from "@/server/uchi-os/decision-engine/decision-status";
import type { Prisma } from "@prisma/client";

// 23章 Feedback Loop: Expected Impact と Actual Impact を対で保存する。
// 本格的な学習ループ(historicalPriorの自動更新等)はPhase4、Phase2では記録のみ行う。
const verifySchema = z.object({
  metric: z.string().min(1).max(100),
  value: z.number(),
  unit: z.string().min(1).max(20),
  note: z.string().max(1000).optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const body = verifySchema.parse(await request.json());

    const action = await prisma.action.findFirst({ where: { id, organizationId: session.organizationId } });
    if (!action) return apiError("NOT_FOUND", "Actionが見つかりません", 404);
    if (action.status !== "COMPLETED") {
      return apiError("INVALID_STATE", "完了(Completed)のActionのみ実績を記録できます", 409);
    }

    const updated = await prisma.action.update({
      where: { id },
      data: {
        status: "RESULT_VERIFIED",
        actualImpact: body as unknown as Prisma.InputJsonValue,
      },
    });
    await markDecisionReviewed(action.decisionId);

    await prisma.auditLog.create({
      data: {
        organizationId: session.organizationId,
        userId: session.userId,
        action: "action.verify",
        targetType: "Action",
        targetId: id,
        metadata: body,
      },
    });

    return NextResponse.json({ action: updated });
  } catch (error) {
    if (error instanceof z.ZodError) return apiError("VALIDATION_ERROR", "実績値を入力してください", 400);
    return handleApiError(error);
  }
}
