import { NextResponse } from "next/server";
import { prisma } from "@/lib/crm/prisma";
import { requireSession, apiErrorResponse } from "@/lib/crm/session";
import { CANDIDATE_STAGE_ORDER } from "@/lib/crm/constants";

export async function GET() {
  try {
    await requireSession();
    const candidates = await prisma.candidate.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        lineDisplayName: true,
        stage: true,
        leadStatus: true,
        leadScore: true,
        occupation: { select: { code: true, name: true } },
        assignedStaff: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 500,
    });

    const grouped = Object.fromEntries(CANDIDATE_STAGE_ORDER.map((stage) => [stage, [] as typeof candidates]));
    for (const c of candidates) {
      grouped[c.stage]?.push(c);
    }

    return NextResponse.json({ grouped });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
