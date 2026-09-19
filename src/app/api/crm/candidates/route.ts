import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/crm/prisma";
import { requireSession, apiErrorResponse } from "@/lib/crm/session";

const listQuerySchema = z.object({
  occupation: z.string().optional(),
  timing: z.string().optional(),
  area: z.string().optional(),
  leadStatus: z.string().optional(),
  stage: z.string().optional(),
  tag: z.string().optional(),
  staff: z.string().optional(),
  q: z.string().optional(),
  registeredFrom: z.string().optional(),
  registeredTo: z.string().optional(),
  reactionFrom: z.string().optional(),
  reactionTo: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(request: Request) {
  try {
    await requireSession();
    const url = new URL(request.url);
    const parsed = listQuerySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) {
      return NextResponse.json({ error: "検索条件が不正です。" }, { status: 400 });
    }
    const q = parsed.data;

    const where: Record<string, unknown> = { deletedAt: null };
    if (q.occupation) where.occupation = { code: q.occupation };
    if (q.timing) where.transferTiming = q.timing;
    if (q.area) where.areaId = q.area;
    if (q.leadStatus) where.leadStatus = q.leadStatus;
    if (q.stage) where.stage = q.stage;
    if (q.staff) where.assignedStaffId = q.staff;
    if (q.tag) where.tags = { some: { tag: { code: q.tag } } };
    if (q.registeredFrom || q.registeredTo) {
      where.registeredAt = {
        ...(q.registeredFrom ? { gte: new Date(q.registeredFrom) } : {}),
        ...(q.registeredTo ? { lte: new Date(q.registeredTo) } : {}),
      };
    }
    if (q.reactionFrom || q.reactionTo) {
      where.lastLineReactionAt = {
        ...(q.reactionFrom ? { gte: new Date(q.reactionFrom) } : {}),
        ...(q.reactionTo ? { lte: new Date(q.reactionTo) } : {}),
      };
    }
    if (q.q) {
      where.OR = [
        { name: { contains: q.q } },
        { lineDisplayName: { contains: q.q } },
        { email: { contains: q.q } },
        { phone: { contains: q.q } },
        { memo: { contains: q.q } },
      ];
    }

    const [total, candidates] = await Promise.all([
      prisma.candidate.count({ where }),
      prisma.candidate.findMany({
        where,
        include: {
          occupation: true,
          area: true,
          assignedStaff: { select: { id: true, name: true } },
          tags: { include: { tag: true } },
        },
        orderBy: { updatedAt: "desc" },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);

    return NextResponse.json({
      total,
      page: q.page,
      pageSize: q.pageSize,
      candidates,
    });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
