import { NextResponse } from "next/server";
import { prisma } from "@/lib/crm/prisma";
import { requireSession, apiErrorResponse } from "@/lib/crm/session";
import { CANDIDATE_STAGE_ORDER } from "@/lib/crm/constants";

function resolvePeriod(preset: string | null, from: string | null, to: string | null) {
  const now = new Date();
  const end = to ? new Date(to) : now;
  if (preset === "this_month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start, end: now };
  }
  if (preset === "last_month") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    return { start, end: lastEnd };
  }
  if (preset === "3m") return { start: new Date(now.getTime() - 90 * 86400000), end: now };
  if (preset === "6m") return { start: new Date(now.getTime() - 180 * 86400000), end: now };
  if (preset === "1y") return { start: new Date(now.getTime() - 365 * 86400000), end: now };
  if (from) return { start: new Date(from), end };
  // デフォルト: 直近3ヶ月
  return { start: new Date(now.getTime() - 90 * 86400000), end: now };
}

export async function GET(request: Request) {
  try {
    await requireSession();
    const url = new URL(request.url);
    const { start, end } = resolvePeriod(url.searchParams.get("preset"), url.searchParams.get("from"), url.searchParams.get("to"));

    const registeredInPeriod = { registeredAt: { gte: start, lte: end }, deletedAt: null } as const;

    const [
      totalFriends,
      newRegistrations,
      blockedTotal,
      totalEver,
      withOccupation,
      withTiming,
      cold,
      warm,
      hot,
      casualEvents,
      visitEvents,
      applications,
      interviews,
      offers,
      hires,
      declines,
    ] = await Promise.all([
      prisma.candidate.count({ where: { deletedAt: null, isBlocked: false } }),
      prisma.candidate.count({ where: registeredInPeriod }),
      prisma.candidate.count({ where: { isBlocked: true } }),
      prisma.candidate.count(),
      prisma.candidate.count({ where: { deletedAt: null, occupationId: { not: null } } }),
      prisma.candidate.count({ where: { deletedAt: null, transferTiming: { not: null } } }),
      prisma.candidate.count({ where: { deletedAt: null, leadStatus: "LEAD_COLD" } }),
      prisma.candidate.count({ where: { deletedAt: null, leadStatus: "LEAD_WARM" } }),
      prisma.candidate.count({ where: { deletedAt: null, leadStatus: "LEAD_HOT" } }),
      prisma.candidateEvent.count({ where: { type: "ACT_CASUAL", createdAt: { gte: start, lte: end } } }),
      prisma.candidateEvent.count({ where: { type: "ACT_VISIT", createdAt: { gte: start, lte: end } } }),
      prisma.application.count({ where: { appliedAt: { gte: start, lte: end } } }),
      prisma.candidateEvent.count({ where: { type: "REC_INTERVIEW", createdAt: { gte: start, lte: end } } }),
      prisma.candidateEvent.count({ where: { type: "REC_OFFER", createdAt: { gte: start, lte: end } } }),
      prisma.candidateEvent.count({ where: { type: "REC_HIRED", createdAt: { gte: start, lte: end } } }),
      prisma.candidateEvent.count({ where: { type: "REC_DECLINED", createdAt: { gte: start, lte: end } } }),
    ]);

    const totalPoolByOccupation = await prisma.candidate.groupBy({
      by: ["occupationId"],
      where: { deletedAt: null },
      _count: { _all: true },
    });
    const occupations = await prisma.occupation.findMany();
    const poolByOccupation = totalPoolByOccupation.map((row) => ({
      occupation: occupations.find((o) => o.id === row.occupationId)?.name ?? "未設定",
      count: row._count._all,
    }));

    // ファネル: 登録期間内の候補者を現在のステージで集計 (簡易実装)
    const funnelCounts = await Promise.all(
      CANDIDATE_STAGE_ORDER.map((stage) =>
        prisma.candidate.count({ where: { ...registeredInPeriod, stage } })
      )
    );
    const funnel = CANDIDATE_STAGE_ORDER.map((stage, i) => ({ stage, count: funnelCounts[i] }));

    const cvr = (numerator: number) => (newRegistrations > 0 ? Math.round((numerator / newRegistrations) * 1000) / 10 : 0);
    const casualOrBeyond = funnel.filter((f) => f.stage !== "NURTURING" && f.stage !== "DECLINED").reduce((s, f) => s + f.count, 0);
    const appliedOrBeyond = funnel
      .filter((f) => ["APPLIED", "INTERVIEW", "OFFER", "HIRED"].includes(f.stage))
      .reduce((s, f) => s + f.count, 0);
    const hiredCount = funnel.find((f) => f.stage === "HIRED")?.count ?? 0;

    return NextResponse.json({
      period: { start, end },
      kpi: {
        totalFriends,
        newRegistrations,
        blockedTotal,
        blockRate: totalEver > 0 ? Math.round((blockedTotal / totalEver) * 1000) / 10 : 0,
        occupationCaptureRate: totalFriends > 0 ? Math.round((withOccupation / totalFriends) * 1000) / 10 : 0,
        timingCaptureRate: totalFriends > 0 ? Math.round((withTiming / totalFriends) * 1000) / 10 : 0,
        cold,
        warm,
        hot,
        casualEvents,
        visitEvents,
        applications,
        interviews,
        offers,
        hires,
        declines,
        cvrToCasual: cvr(casualOrBeyond),
        cvrToApplication: cvr(appliedOrBeyond),
        cvrToHire: cvr(hiredCount),
      },
      poolByOccupation,
      funnel,
    });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
