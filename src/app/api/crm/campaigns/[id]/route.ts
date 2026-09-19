import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/crm/prisma";
import { requireSession, apiErrorResponse } from "@/lib/crm/session";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    await requireSession();
    const { id } = await params;
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        createdByStaff: { select: { name: true } },
        approvedByStaff: { select: { name: true } },
        deliveries: { select: { status: true } },
      },
    });
    if (!campaign) return NextResponse.json({ error: "見つかりません。" }, { status: 404 });
    return NextResponse.json({ campaign });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().min(1).max(2000).optional(),
  ctaLabel: z.string().max(100).nullable().optional(),
  ctaUrl: z.string().url().max(500).nullable().optional(),
  targetOccupations: z.array(z.string()).optional(),
  targetTimings: z.array(z.string()).optional(),
  targetAreas: z.array(z.string()).optional(),
  targetLeadStatuses: z.array(z.string()).optional(),
  targetStages: z.array(z.string()).optional(),
});

// 編集は誤配信防止のため DRAFT / REVIEW 状態のみ許可します。
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    await requireSession({ requireWrite: true });
    const { id } = await params;
    const existing = await prisma.campaign.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "見つかりません。" }, { status: 404 });
    if (existing.status !== "DRAFT" && existing.status !== "REVIEW") {
      return NextResponse.json({ error: "承認後のキャンペーンは編集できません。" }, { status: 409 });
    }

    const json = await request.json().catch(() => null);
    const parsed = updateSchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: "入力内容が不正です。" }, { status: 400 });

    const d = parsed.data;
    const campaign = await prisma.campaign.update({
      where: { id },
      data: {
        ...(d.title !== undefined ? { title: d.title } : {}),
        ...(d.body !== undefined ? { body: d.body } : {}),
        ...(d.ctaLabel !== undefined ? { ctaLabel: d.ctaLabel } : {}),
        ...(d.ctaUrl !== undefined ? { ctaUrl: d.ctaUrl } : {}),
        ...(d.targetOccupations !== undefined ? { targetOccupations: JSON.stringify(d.targetOccupations) } : {}),
        ...(d.targetTimings !== undefined ? { targetTimings: JSON.stringify(d.targetTimings) } : {}),
        ...(d.targetAreas !== undefined ? { targetAreas: JSON.stringify(d.targetAreas) } : {}),
        ...(d.targetLeadStatuses !== undefined ? { targetLeadStatuses: JSON.stringify(d.targetLeadStatuses) } : {}),
        ...(d.targetStages !== undefined ? { targetStages: JSON.stringify(d.targetStages) } : {}),
      },
    });

    return NextResponse.json({ campaign });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
