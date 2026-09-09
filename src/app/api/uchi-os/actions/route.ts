import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/server/uchi-os/auth/rbac";
import { handleApiError } from "@/server/uchi-os/http";
import { prisma } from "@/server/uchi-os/db/client";
import type { ActionStatus } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const status = request.nextUrl.searchParams.get("status") as ActionStatus | null;

    const actions = await prisma.action.findMany({
      where: {
        organizationId: session.organizationId,
        ...(status ? { status } : {}),
      },
      include: {
        decision: { include: { station: { select: { name: true } } } },
        owner: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({
      actions: actions.map((a) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        status: a.status,
        requiresApprovalCategory: a.requiresApprovalCategory,
        deadline: a.deadline,
        owner: a.owner,
        holdReason: a.holdReason,
        stationName: a.decision.station?.name ?? "法人全体",
        ruleCode: a.decision.ruleCode,
        actualImpact: a.actualImpact,
        createdAt: a.createdAt,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
