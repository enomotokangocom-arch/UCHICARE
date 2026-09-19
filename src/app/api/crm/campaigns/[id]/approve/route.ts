import { NextResponse } from "next/server";
import { prisma } from "@/lib/crm/prisma";
import { requireSession, apiErrorResponse } from "@/lib/crm/session";
import { writeAuditLog, getClientIp } from "@/lib/crm/audit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// 誤配信防止のため、承認は管理者(ADMIN)のみに限定します。
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await requireSession({ requireAdmin: true });
    const { id } = await params;
    const existing = await prisma.campaign.findUniqueOrThrow({ where: { id } });
    if (existing.status !== "REVIEW") {
      return NextResponse.json({ error: "レビュー中のキャンペーンのみ承認できます。" }, { status: 409 });
    }
    const campaign = await prisma.campaign.update({
      where: { id },
      data: { status: "APPROVED", approvedByStaffId: session.staffId, approvedAt: new Date() },
    });

    await writeAuditLog({
      staffId: session.staffId,
      action: "CAMPAIGN_APPROVE",
      targetType: "Campaign",
      targetId: id,
      ip: getClientIp(request),
    });

    return NextResponse.json({ campaign });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
