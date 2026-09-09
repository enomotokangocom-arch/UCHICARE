import { prisma } from "@/server/uchi-os/db/client";
import { computeMonthlyKpis } from "@/server/uchi-os/kpi-engine/compute";
import { getKpiTrend } from "@/server/uchi-os/kpi-engine/trend";
import { getEmployeeWorkloads } from "@/server/uchi-os/kpi-engine/workforce-detail";
import { getReferralSourceDetails } from "@/server/uchi-os/kpi-engine/referral-detail";
import type { Priority, ApprovalCategory, Prisma } from "@prisma/client";
import { resolveThresholdsForRules } from "./thresholds";
import {
  evaluateRevenueDecline,
  evaluateRevenueForecastMiss,
  evaluatePatientNetDecrease,
  evaluateEndedPatientSurge,
  evaluateNewPatientDecline,
  evaluateUtilizationDrop,
  evaluateOverutilization,
  evaluateLaborCostRatioRise,
  evaluateOperatingMarginDecline,
  evaluateInsufficientSalesActivity,
  evaluateReferralRateDecline,
  evaluateKeyReferralSourceDormant,
  evaluateNurseShortage,
  evaluateNurseSurplus,
  evaluateHiringNeed,
  evaluateHiringFreeze,
  evaluateCashRunway,
  evaluateStationDeficit,
  evaluateNewStationOpportunity,
  evaluateWithdrawalConsideration,
  toKpiMap,
  type RuleFinding,
  type Severity,
} from "./rules";

// 04章のレイヤー構成に対応:
//   Rule/Anomaly Engine (evaluateAllRules) -> Alert Engine (syncAlerts) -> Decision Engine (syncDecisions)
// 20ルール全ての評価結果を Alert として冪等に反映し、条件が解消したAlertは自動的にRESOLVEDへ遷移する。
// Alertが「有効(OPEN/ACKNOWLEDGED)」な間、対応するDecision/Actionを生成・更新する。

const STATION_TREND_KPI_CODES = [
  "monthly_revenue",
  "ended_patients",
  "new_patients",
  "net_patient_change",
  "operating_profit_margin",
  "sales_activity_count",
  "referral_rate",
  "utilization_rate",
  "station_operating_profit",
  "total_visit_minutes",
];
const TREND_MONTHS = 13;

const STATION_RULE_CODES = [
  "DR-01",
  "DR-02",
  "DR-03",
  "DR-04",
  "DR-05",
  "DR-06",
  "DR-07",
  "DR-08",
  "DR-09",
  "DR-10",
  "DR-11",
  "DR-12",
  "DR-13",
  "DR-14",
  "DR-16",
  "DR-18",
  "DR-20",
];
const COMPANY_RULE_CODES = ["DR-17", "DR-19"];

const OPEN_ALERT_STATUSES = ["OPEN", "ACKNOWLEDGED"] as const;
const OPEN_DECISION_STATUSES = ["DRAFT", "AI_RECOMMENDED", "HUMAN_REVIEWED"] as const;

function toPriority(severity: Severity): Priority {
  if (severity === "CRITICAL") return "CRITICAL";
  if (severity === "WARNING") return "HIGH";
  return "MEDIUM";
}

interface Finding {
  stationId: string | null;
  finding: RuleFinding;
}

async function evaluateStation(
  organizationId: string,
  station: { id: string; name: string },
  yearMonth: string,
): Promise<{ findings: Finding[]; utilizationRate: number | null }> {
  const [kpiEntries, trend, workloads, hasOpenRecruitment] = await Promise.all([
    computeMonthlyKpis(organizationId, station.id, yearMonth),
    getKpiTrend(organizationId, station.id, STATION_TREND_KPI_CODES, TREND_MONTHS, yearMonth),
    getEmployeeWorkloads(organizationId, station.id, yearMonth),
    prisma.recruitmentRecord
      .count({ where: { organizationId, stationId: station.id, status: { in: ["OPEN", "INTERVIEWING", "OFFERED"] } } })
      .then((count) => count > 0),
  ]);

  const kpis = toKpiMap(kpiEntries);
  const thresholds = await resolveThresholdsForRules(organizationId, station.id, STATION_RULE_CODES);
  const referralSources = await getReferralSourceDetails(
    organizationId,
    station.id,
    yearMonth,
    thresholds["DR-12"].top_contribution_pct,
  );

  const shortageFinding = evaluateNurseShortage(station.name, kpis, trend, thresholds["DR-13"]);

  const findings: (RuleFinding | null)[] = [
    evaluateRevenueDecline(station.name, kpis, thresholds["DR-01"]),
    evaluateRevenueForecastMiss(station.name, trend, thresholds["DR-02"]),
    evaluatePatientNetDecrease(station.name, trend, thresholds["DR-03"]),
    evaluateEndedPatientSurge(station.name, trend, thresholds["DR-04"]),
    evaluateNewPatientDecline(station.name, kpis, trend, thresholds["DR-05"]),
    evaluateUtilizationDrop(station.name, kpis, thresholds["DR-06"]),
    evaluateOverutilization(station.name, kpis, workloads, thresholds["DR-07"]),
    evaluateLaborCostRatioRise(station.name, kpis, thresholds["DR-08"]),
    evaluateOperatingMarginDecline(station.name, kpis, trend, thresholds["DR-09"]),
    evaluateInsufficientSalesActivity(station.name, trend, thresholds["DR-10"]),
    evaluateReferralRateDecline(station.name, trend, thresholds["DR-11"]),
    evaluateKeyReferralSourceDormant(station.name, referralSources, thresholds["DR-12"]),
    shortageFinding,
    evaluateNurseSurplus(station.name, trend, thresholds["DR-14"]),
    evaluateHiringNeed(station.name, kpis, shortageFinding),
    evaluateHiringFreeze(station.name, kpis, hasOpenRecruitment, thresholds["DR-16"]),
    evaluateStationDeficit(station.name, trend, thresholds["DR-18"]),
    evaluateWithdrawalConsideration(station.name, trend, thresholds["DR-20"]),
  ];

  const utilEntry = kpis.get("utilization_rate");
  const utilizationRate = utilEntry && !utilEntry.insufficientData ? utilEntry.value : null;

  return {
    findings: findings.filter((f): f is RuleFinding => f != null).map((finding) => ({ stationId: station.id, finding })),
    utilizationRate,
  };
}

async function evaluateCompany(organizationId: string, yearMonth: string, stationUtilizations: number[]): Promise<Finding[]> {
  const kpiEntries = await computeMonthlyKpis(organizationId, null, yearMonth);
  const kpis = toKpiMap(kpiEntries);
  const thresholds = await resolveThresholdsForRules(organizationId, null, COMPANY_RULE_CODES);
  const averageUtilization =
    stationUtilizations.length > 0 ? stationUtilizations.reduce((a, b) => a + b, 0) / stationUtilizations.length : null;

  const findings = [
    evaluateCashRunway(kpis, thresholds["DR-17"]),
    evaluateNewStationOpportunity(kpis, averageUtilization, thresholds["DR-19"]),
  ];

  return findings.filter((f): f is RuleFinding => f != null).map((finding) => ({ stationId: null, finding }));
}

/**
 * 20 Decision Rules全てを評価し、Alert/Decision/Actionを冪等に生成・更新する。
 * 条件が解消したルールに対応するAlertは自動的にRESOLVEDへ遷移する(Alert Engine)。
 * CEO Morning表示のたびに呼ばれる想定 (Phase2もオンデマンド計算のまま、04.5節)。
 */
export async function ensureDecisionsForOrg(organizationId: string, yearMonth: string): Promise<void> {
  const stations = await prisma.station.findMany({
    where: { organizationId, status: "ACTIVE" },
    select: { id: true, name: true },
  });

  const allFindings: Finding[] = [];
  const stationUtilizations: number[] = [];

  for (const station of stations) {
    const { findings, utilizationRate } = await evaluateStation(organizationId, station, yearMonth);
    allFindings.push(...findings);
    if (utilizationRate != null) stationUtilizations.push(utilizationRate);
  }

  allFindings.push(...(await evaluateCompany(organizationId, yearMonth, stationUtilizations)));

  await syncAlertsAndDecisions(organizationId, yearMonth, allFindings);
}

async function syncAlertsAndDecisions(organizationId: string, yearMonth: string, findings: Finding[]): Promise<void> {
  const activeAlerts = await prisma.alert.findMany({
    where: { organizationId, status: { in: [...OPEN_ALERT_STATUSES] } },
  });

  const firingKeys = new Set(findings.map((f) => alertKey(f.stationId, f.finding.ruleCode)));

  // 条件が解消したルールのAlertは自動的にRESOLVEDへ遷移する(Alert Engineのライフサイクル管理)。
  for (const alert of activeAlerts) {
    if (!firingKeys.has(alertKey(alert.stationId, alert.ruleCode))) {
      await prisma.alert.update({ where: { id: alert.id }, data: { status: "RESOLVED" } });
    }
  }

  for (const { stationId, finding } of findings) {
    const existingAlert = activeAlerts.find((a) => a.stationId === stationId && a.ruleCode === finding.ruleCode);

    const alert = existingAlert
      ? await prisma.alert.update({
          where: { id: existingAlert.id },
          data: { severity: finding.severity, title: finding.title, yearMonth },
        })
      : await prisma.alert.create({
          data: {
            organizationId,
            stationId,
            ruleCode: finding.ruleCode,
            severity: finding.severity,
            title: finding.title,
            yearMonth,
            status: "OPEN",
          },
        });

    await upsertDecisionFromFinding(organizationId, stationId, alert.id, finding);
  }
}

function alertKey(stationId: string | null, ruleCode: string): string {
  return `${stationId ?? "COMPANY"}:${ruleCode}`;
}

async function upsertDecisionFromFinding(
  organizationId: string,
  stationId: string | null,
  alertId: string,
  finding: RuleFinding,
): Promise<void> {
  const existing = await prisma.decision.findFirst({
    where: { organizationId, alertId, status: { in: [...OPEN_DECISION_STATUSES] } },
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

  const decision = await prisma.decision.create({
    data: {
      organizationId,
      stationId,
      alertId,
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
