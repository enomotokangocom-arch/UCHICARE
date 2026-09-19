import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/crm/prisma";
import { requireSession, apiErrorResponse } from "@/lib/crm/session";
import { writeAuditLog, getClientIp } from "@/lib/crm/audit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    await requireSession();
    const { id } = await params;

    const candidate = await prisma.candidate.findUnique({
      where: { id },
      include: {
        occupation: true,
        area: true,
        inflowSource: true,
        assignedStaff: { select: { id: true, name: true, email: true } },
        tags: { include: { tag: true } },
        events: { orderBy: { createdAt: "desc" }, take: 200, include: { actorStaff: { select: { name: true } } } },
        recruitmentActivity: { orderBy: { occurredAt: "desc" }, include: { staff: { select: { name: true } } } },
        interviews: { orderBy: { scheduledAt: "desc" } },
        visits: { orderBy: { scheduledAt: "desc" } },
        applications: { orderBy: { appliedAt: "desc" } },
      },
    });

    if (!candidate || candidate.deletedAt) {
      return NextResponse.json({ error: "候補者が見つかりません。" }, { status: 404 });
    }

    return NextResponse.json({ candidate });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

const updateSchema = z.object({
  name: z.string().max(200).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  email: z.string().email().max(200).nullable().optional().or(z.literal("")),
  occupationId: z.string().nullable().optional(),
  occupationDetail: z.string().max(200).nullable().optional(),
  transferTiming: z.enum(["TIME_NOW", "TIME_3M", "TIME_6_12M", "TIME_RESEARCH"]).nullable().optional(),
  areaId: z.string().nullable().optional(),
  assignedStaffId: z.string().nullable().optional(),
  memo: z.string().max(5000).nullable().optional(),
  leadStatus: z.enum(["LEAD_COLD", "LEAD_WARM", "LEAD_HOT"]).optional(),
});

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const session = await requireSession({ requireWrite: true });
    const { id } = await params;
    const json = await request.json().catch(() => null);
    const parsed = updateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "入力内容が不正です。", details: parsed.error.flatten() }, { status: 400 });
    }

    const before = await prisma.candidate.findUnique({ where: { id } });
    if (!before || before.deletedAt) {
      return NextResponse.json({ error: "候補者が見つかりません。" }, { status: 404 });
    }

    const data = { ...parsed.data };
    if (data.email === "") data.email = null;

    const updated = await prisma.candidate.update({ where: { id }, data });

    await writeAuditLog({
      staffId: session.staffId,
      action: "CANDIDATE_UPDATE",
      targetType: "Candidate",
      targetId: id,
      before,
      after: updated,
      ip: getClientIp(request),
    });

    return NextResponse.json({ candidate: updated });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await requireSession({ requireAdmin: true });
    const { id } = await params;
    const candidate = await prisma.candidate.update({ where: { id }, data: { deletedAt: new Date() } });
    await writeAuditLog({
      staffId: session.staffId,
      action: "CANDIDATE_SOFT_DELETE",
      targetType: "Candidate",
      targetId: id,
      ip: getClientIp(request),
    });
    return NextResponse.json({ candidate });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
