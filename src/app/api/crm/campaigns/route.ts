import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/crm/prisma";
import { requireSession, apiErrorResponse } from "@/lib/crm/session";

const campaignStatusSchema = z.enum(["DRAFT", "REVIEW", "APPROVED", "SCHEDULED", "SENT"]);

export async function GET(request: Request) {
  try {
    await requireSession();
    const url = new URL(request.url);
    const statusParam = campaignStatusSchema.safeParse(url.searchParams.get("status"));
    const campaigns = await prisma.campaign.findMany({
      where: statusParam.success ? { status: statusParam.data } : undefined,
      orderBy: { updatedAt: "desc" },
      include: { createdByStaff: { select: { name: true } }, approvedByStaff: { select: { name: true } } },
    });
    return NextResponse.json({ campaigns });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

const createSchema = z.object({
  title: z.string().min(1).max(200),
  category: z.string().min(1).max(100),
  body: z.string().min(1).max(2000),
  imageUrl: z.string().url().max(500).optional(),
  ctaLabel: z.string().max(100).optional(),
  ctaUrl: z.string().url().max(500).optional(),
  targetOccupations: z.array(z.string()).optional(),
  targetTimings: z.array(z.string()).optional(),
  targetAreas: z.array(z.string()).optional(),
  targetLeadStatuses: z.array(z.string()).optional(),
  targetStages: z.array(z.string()).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await requireSession({ requireWrite: true });
    const json = await request.json().catch(() => null);
    const parsed = createSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "入力内容が不正です。", details: parsed.error.flatten() }, { status: 400 });
    }

    const d = parsed.data;
    const campaign = await prisma.campaign.create({
      data: {
        title: d.title,
        category: d.category,
        body: d.body,
        imageUrl: d.imageUrl,
        ctaLabel: d.ctaLabel,
        ctaUrl: d.ctaUrl,
        targetOccupations: d.targetOccupations ? JSON.stringify(d.targetOccupations) : null,
        targetTimings: d.targetTimings ? JSON.stringify(d.targetTimings) : null,
        targetAreas: d.targetAreas ? JSON.stringify(d.targetAreas) : null,
        targetLeadStatuses: d.targetLeadStatuses ? JSON.stringify(d.targetLeadStatuses) : null,
        targetStages: d.targetStages ? JSON.stringify(d.targetStages) : null,
        createdByStaffId: session.staffId,
      },
    });

    return NextResponse.json({ campaign });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
