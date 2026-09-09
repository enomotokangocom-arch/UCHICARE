import { prisma } from "@/server/uchi-os/db/client";
import { computeHealthScore, type HealthScoreWithTrend } from "@/server/uchi-os/health-score/compute";
import { ensureDecisionsForOrg } from "@/server/uchi-os/decision-engine/generate";

const PRIORITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export interface CeoMorningAction {
  id: string;
  title: string;
  description: string;
  status: string;
  requiresApprovalCategory: string | null;
  deadline: Date | null;
}

export interface CeoMorningDecision {
  id: string;
  ruleCode: string;
  priority: string;
  status: string;
  stationId: string | null;
  stationName: string;
  problemSummary: string;
  rootCause: unknown;
  predictedImpact: number | null;
  confidence: number;
  actions: CeoMorningAction[];
}

export interface CeoMorningData {
  yearMonth: string;
  healthScore: HealthScoreWithTrend;
  decisions: CeoMorningDecision[];
}

/** CEO Morning画面 (画面) と /api/uchi-os/ceo-morning (API) の両方から使う共通データ取得。 */
export async function getCeoMorningData(organizationId: string, yearMonth: string): Promise<CeoMorningData> {
  await ensureDecisionsForOrg(organizationId, yearMonth);

  const [healthScore, decisions] = await Promise.all([
    computeHealthScore(organizationId, yearMonth),
    prisma.decision.findMany({
      where: {
        organizationId,
        status: { in: ["AI_RECOMMENDED", "HUMAN_REVIEWED"] },
        // 根拠となったAlertが自動解消(RESOLVED)・却下(DISMISSED)された場合はTODAYに出さない。
        alert: { status: { in: ["OPEN", "ACKNOWLEDGED"] } },
      },
      include: { station: { select: { id: true, name: true } }, actions: { orderBy: { createdAt: "asc" } } },
      orderBy: [{ createdAt: "desc" }],
    }),
  ]);

  const sorted = decisions
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || b.confidence - a.confidence)
    .slice(0, 5);

  return {
    yearMonth,
    healthScore,
    decisions: sorted.map((d) => ({
      id: d.id,
      ruleCode: d.ruleCode,
      priority: d.priority,
      status: d.status,
      stationId: d.stationId,
      stationName: d.station?.name ?? "法人全体",
      problemSummary: d.problemSummary,
      rootCause: d.rootCause,
      predictedImpact: d.predictedImpact != null ? Number(d.predictedImpact) : null,
      confidence: d.confidence,
      actions: d.actions.map((a) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        status: a.status,
        requiresApprovalCategory: a.requiresApprovalCategory,
        deadline: a.deadline,
      })),
    })),
  };
}
