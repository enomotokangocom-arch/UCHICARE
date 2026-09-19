import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/crm/prisma";
import { requireSession, apiErrorResponse } from "@/lib/crm/session";
import { writeAuditLog, getClientIp } from "@/lib/crm/audit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const schema = z.object({ scheduledAt: z.string() });

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await requireSession({ requireAdmin: true });
    const { id } = await params;
    const existing = await prisma.campaign.findUniqueOrThrow({ where: { id } });
    if (existing.status !== "APPROVED") {
      return NextResponse.json({ error: "承認済みのキャンペーンのみ予約できます。" }, { status: 409 });
    }

    const json = await request.json().catch(() => null);
    const parsed = schema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: "配信予定日時を指定してください。" }, { status: 400 });

    const campaign = await prisma.campaign.update({
      where: { id },
      data: { status: "SCHEDULED", scheduledAt: new Date(parsed.data.scheduledAt) },
    });

    await writeAuditLog({
      staffId: session.staffId,
      action: "CAMPAIGN_SCHEDULE",
      targetType: "Campaign",
      targetId: id,
      after: { scheduledAt: campaign.scheduledAt },
      ip: getClientIp(request),
    });

    return NextResponse.json({ campaign });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
