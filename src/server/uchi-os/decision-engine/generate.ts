import { prisma } from "@/server/uchi-os/db/client";
import { computeMonthlyKpis } from "@/server/uchi-os/kpi-engine/compute";
import type { Priority, Severity as PrismaSeverity, ApprovalCategory, Prisma } from "@prisma/client";
import {
  evaluateRevenueDecline,
  evaluateUtilizationDrop,
  evaluateCashRunway,
  toKpiMap,
  type RuleFinding,
  type Severity,
} from "./rules";

function toPriority(severity: Severity): Priority {
  if (severity === "CRITICAL") return "CRITICAL";
  if (severity === "WARNING") return "HIGH";
  return "MEDIUM";
}

function toAlertSeverity(severity: Severity): PrismaSeverity {
  return severity;
}

const OPEN_DECISION_STATUSES = ["DRAFT", "AI_RECOMMENDED", "HUMAN_REVIEWED"] as const;

/**
 * 07章の簡易実装(DR-01/DR-06/DR-17)を全拠点＋法人全体に適用し、Alert/Decision/Actionを
 * 冪等に生成・更新する(既にHuman Approved等になったActionは上書きしない)。
 * CEO Morning表示のたびに呼ばれる想定 (Phase1は日次バッチではなくオンデマンド計算、04.5節)。
 */
export async function ensureDecisionsForOrg(organizationId: string, yearMonth: string): Promise<void> {
  const stations = await prisma.station.findMany({
    where: { organizationId, status: "ACTIVE" },
    select: { id: true, name: true },
  });

  const findings: { stationId: string | null; finding: RuleFinding }[] = [];

  for (const station of stations) {
    const kpis = toKpiMap(await computeMonthlyKpis(organizationId, station.id, yearMonth));
    const revenueFinding = evaluateRevenueDecline(station.name, kpis);
    if (revenueFinding) findings.push({ stationId: station.id, finding: revenueFinding });
    const utilizationFinding = evaluateUtilizationDrop(station.name, kpis);
    if (utilizationFinding) findings.push({ stationId: station.id, finding: utilizationFinding });
  }

  const companyKpis = toKpiMap(await computeMonthlyKpis(organizationId, null, yearMonth));
  const cashFinding = evaluateCashRunway(companyKpis);
  if (cashFinding) findings.push({ stationId: null, finding: cashFinding });

  for (const { stationId, finding } of findings) {
    await upsertDecisionFromFinding(organizationId, stationId, yearMonth, finding);
  }
}

async function upsertDecisionFromFinding(
  organizationId: string,
  stationId: string | null,
  yearMonth: string,
  finding: RuleFinding,
): Promise<void> {
  const existing = await prisma.decision.findFirst({
    where: {
      organizationId,
      stationId,
      ruleCode: finding.ruleCode,
      status: { in: [...OPEN_DECISION_STATUSES] },
    },
    include: { actions: true },
  });

  if (existing) {
    await prisma.decision.update({
      where: { id: existing.id },
      data: {
        priority: toPriority(finding.severity),
        problemSummary: finding.problemSummary,
        rootCause: finding.rootCause as unknown as Prisma.InputJsonValue,
        predictedImpact: finding.predictedImpact,
        confidence: finding.confidence,
      },
    });
    return;
  }

  const alert = await prisma.alert.create({
    data: {
      organizationId,
      stationId,
      ruleCode: finding.ruleCode,
      severity: toAlertSeverity(finding.severity),
      title: finding.title,
      yearMonth,
      status: "OPEN",
    },
  });

  const decision = await prisma.decision.create({
    data: {
      organizationId,
      stationId,
      alertId: alert.id,
      ruleCode: finding.ruleCode,
      priority: toPriority(finding.severity),
      problemSummary: finding.problemSummary,
      rootCause: finding.rootCause as unknown as Prisma.InputJsonValue,
      predictedImpact: finding.predictedImpact,
      confidence: finding.confidence,
      status: "AI_RECOMMENDED",
    },
  });

  for (const action of finding.recommendedActions) {
    await prisma.action.create({
      data: {
        organizationId,
        decisionId: decision.id,
        title: action.title,
        description: action.description,
        requiresApprovalCategory: (action.approvalCategory as ApprovalCategory | undefined) ?? null,
        status: "AI_RECOMMENDED",
      },
    });
  }
}
