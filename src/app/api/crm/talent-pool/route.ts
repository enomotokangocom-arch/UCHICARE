import { NextResponse } from "next/server";
import { prisma } from "@/lib/crm/prisma";
import { requireSession, apiErrorResponse } from "@/lib/crm/session";

export async function GET() {
  try {
    await requireSession();

    const occupations = await prisma.occupation.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
    const now = new Date();

    const pools = await Promise.all(
      occupations.map(async (occ) => {
        const where = { deletedAt: null, occupationId: occ.id };
        const [total, cold, warm, hot, timeNow, time3m] = await Promise.all([
          prisma.candidate.count({ where }),
          prisma.candidate.count({ where: { ...where, leadStatus: "LEAD_COLD" } }),
          prisma.candidate.count({ where: { ...where, leadStatus: "LEAD_WARM" } }),
          prisma.candidate.count({ where: { ...where, leadStatus: "LEAD_HOT" } }),
          prisma.candidate.count({ where: { ...where, transferTiming: "TIME_NOW" } }),
          prisma.candidate.count({ where: { ...where, transferTiming: { in: ["TIME_NOW", "TIME_3M"] } } }),
        ]);
        return {
          occupation: { code: occ.code, name: occ.name },
          total,
          cold,
          warm,
          hot,
          within3Months: time3m,
          immediate: timeNow,
        };
      })
    );

    const totalCandidates = await prisma.candidate.count({ where: { deletedAt: null } });

    return NextResponse.json({ pools, totalCandidates, generatedAt: now });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
