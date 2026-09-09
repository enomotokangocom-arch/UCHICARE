import { NextRequest, NextResponse } from "next/server";
import { requireSession, assertCanApprove } from "@/server/uchi-os/auth/rbac";
import { handleApiError, apiError } from "@/server/uchi-os/http";
import { prisma } from "@/server/uchi-os/db/client";
import { markDecisionReviewed } from "@/server/uchi-os/decision-engine/decision-status";

const APPROVABLE_FROM = ["DRAFT", "AI_RECOMMENDED", "HELD"];

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;

    const action = await prisma.action.findFirst({ where: { id, organizationId: session.organizationId } });
    if (!action) return apiError("NOT_FOUND", "Actionが見つかりません", 404);
    if (!APPROVABLE_FROM.includes(action.status)) {
      return apiError("INVALID_STATE", `現在のステータス(${action.status})からは承認できません`, 409);
    }

    // 11章: 重要判断カテゴリ(採用/解雇/給与/投資/借入/契約/出店/撤退)は承認権限を厳格にチェックする。
    assertCanApprove(session, action.requiresApprovalCategory);

    const updated = await prisma.action.update({
      where: { id },
      data: {
        status: "HUMAN_APPROVED",
        approvedByUserId: session.userId,
        approvedAt: new Date(),
        holdReason: null,
      },
    });
    await markDecisionReviewed(action.decisionId);

    await prisma.auditLog.create({
      data: {
        organizationId: session.organizationId,
        userId: session.userId,
        action: "action.approve",
        targetType: "Action",
        targetId: id,
      },
    });

    return NextResponse.json({ action: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
