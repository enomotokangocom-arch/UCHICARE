// Rule / Anomaly Engine — Phase1簡易実装 (15章 T5: DR-01, DR-06, DR-17の3ルールのみ)。
// 閾値はAnomalyThresholdテーブルの値を優先し、未設定ならデフォルト値を使う (07章冒頭の方針)。

import type { KpiEntry } from "@/server/uchi-os/kpi-engine/compute";
import { computeConfidence } from "./confidence";

export type Severity = "INFO" | "WARNING" | "CRITICAL";

export interface RootCauseFactor {
  label: string;
  kpiCode: string;
  value: number | null;
}

export interface RecommendedAction {
  title: string;
  description: string;
  approvalCategory?: string;
}

export interface RuleFinding {
  ruleCode: string;
  severity: Severity;
  title: string;
  problemSummary: string;
  rootCause: { factors: RootCauseFactor[] };
  predictedImpact: number | null;
  confidence: number;
  recommendedActions: RecommendedAction[];
}

export type KpiMap = Map<string, KpiEntry>;

export function toKpiMap(entries: KpiEntry[]): KpiMap {
  return new Map(entries.map((e) => [e.kpiCode, e]));
}

function val(kpis: KpiMap, code: string): number | null {
  const entry = kpis.get(code);
  if (!entry || entry.insufficientData) return null;
  return entry.value;
}

export interface RuleThresholds {
  revenueDropWarnPct: number; // default -5
  revenueDropCriticalPct: number; // default -10
  utilizationWarnPct: number; // default 75
  utilizationCriticalPct: number; // default 65
  cashRunwayWarnMonths: number; // default 6
  cashRunwayCriticalMonths: number; // default 3
}

export const DEFAULT_THRESHOLDS: RuleThresholds = {
  revenueDropWarnPct: -5,
  revenueDropCriticalPct: -10,
  utilizationWarnPct: 75,
  utilizationCriticalPct: 65,
  cashRunwayWarnMonths: 6,
  cashRunwayCriticalMonths: 3,
};

/** DR-01 売上低下 */
export function evaluateRevenueDecline(
  stationName: string,
  kpis: KpiMap,
  thresholds: RuleThresholds = DEFAULT_THRESHOLDS,
): RuleFinding | null {
  const revenueMoM = val(kpis, "revenue_mom");
  const revenue = val(kpis, "monthly_revenue");
  const prevRevenue = revenue != null && revenueMoM != null ? revenue / (1 + revenueMoM / 100) : null;

  if (revenueMoM == null || revenueMoM > thresholds.revenueDropWarnPct) return null;

  const severity: Severity = revenueMoM <= thresholds.revenueDropCriticalPct ? "CRITICAL" : "WARNING";
  const newPatients = val(kpis, "new_patients");
  const endedPatients = val(kpis, "ended_patients");
  const utilizationRate = val(kpis, "utilization_rate");

  const factors: RootCauseFactor[] = [];
  if (endedPatients != null && endedPatients > 0) {
    factors.push({ label: "利用終了増加", kpiCode: "ended_patients", value: endedPatients });
  }
  if (newPatients != null) {
    factors.push({ label: "新規利用開始", kpiCode: "new_patients", value: newPatients });
  }
  if (utilizationRate != null && utilizationRate < thresholds.utilizationWarnPct) {
    factors.push({ label: "看護師稼働率低下", kpiCode: "utilization_rate", value: utilizationRate });
  }

  const predictedImpact = revenue != null && prevRevenue != null ? Math.round(revenue - prevRevenue) : null;
  const dataCompleteness = [revenueMoM, revenue, newPatients, endedPatients].filter((v) => v != null).length / 4;
  const signalStrength = Math.min(1, Math.abs(revenueMoM) / Math.abs(thresholds.revenueDropWarnPct));

  return {
    ruleCode: "DR-01",
    severity,
    title: `${stationName}の月間売上が前月比${revenueMoM.toFixed(1)}%低下`,
    problemSummary: `${stationName}の月間売上が前月比${revenueMoM.toFixed(1)}%低下しています。`,
    rootCause: { factors },
    predictedImpact,
    confidence: computeConfidence({ dataCompleteness, signalStrength }),
    recommendedActions: [
      { title: `${stationName}への営業活動集中`, description: "今週の営業活動を対象拠点へ重点配分する。" },
      { title: "過去90日で紹介実績のある紹介元への再訪", description: "紹介実績のある居宅介護支援事業所等へ優先的に再訪する。" },
      { title: "新規採用の一時保留を検討", description: "稼働率が低い場合は採用計画を見直す（DR-16参照）。" },
      { title: "管理者との15分レビュー", description: "拠点管理者と状況を共有し、現場要因を確認する。" },
    ],
  };
}

/** DR-06 稼働率低下 */
export function evaluateUtilizationDrop(
  stationName: string,
  kpis: KpiMap,
  thresholds: RuleThresholds = DEFAULT_THRESHOLDS,
): RuleFinding | null {
  const utilizationRate = val(kpis, "utilization_rate");
  if (utilizationRate == null || utilizationRate >= thresholds.utilizationWarnPct) return null;

  const severity: Severity = utilizationRate < thresholds.utilizationCriticalPct ? "CRITICAL" : "WARNING";
  const patientCount = val(kpis, "patient_count");
  const visitMinutesPerNurse = val(kpis, "visit_minutes_per_nurse");

  const factors: RootCauseFactor[] = [{ label: "稼働率", kpiCode: "utilization_rate", value: utilizationRate }];
  if (patientCount != null) factors.push({ label: "利用者数", kpiCode: "patient_count", value: patientCount });
  if (visitMinutesPerNurse != null) {
    factors.push({ label: "看護師1人当たり訪問時間", kpiCode: "visit_minutes_per_nurse", value: visitMinutesPerNurse });
  }

  const signalStrength = Math.min(1, (thresholds.utilizationWarnPct - utilizationRate) / thresholds.utilizationWarnPct);

  return {
    ruleCode: "DR-06",
    severity,
    title: `${stationName}の稼働率が${utilizationRate.toFixed(1)}%まで低下`,
    problemSummary: `${stationName}の看護師稼働率が${utilizationRate.toFixed(1)}%まで低下しています。`,
    rootCause: { factors },
    predictedImpact: null,
    confidence: computeConfidence({ dataCompleteness: 1, signalStrength }),
    recommendedActions: [
      { title: "訪問スケジュールの最適化", description: "職員間の訪問配分を見直し、稼働の偏りを解消する。" },
      { title: "利用者増加に向けた営業強化", description: "新規利用開始を増やし稼働率を回復させる。" },
    ],
  };
}

/** DR-17 Cash Runway低下（法人全体のみ評価） */
export function evaluateCashRunway(
  kpis: KpiMap,
  thresholds: RuleThresholds = DEFAULT_THRESHOLDS,
): RuleFinding | null {
  const runway = val(kpis, "cash_runway_months");
  if (runway == null || !Number.isFinite(runway) || runway >= thresholds.cashRunwayWarnMonths) return null;

  const severity: Severity = runway < thresholds.cashRunwayCriticalMonths ? "CRITICAL" : "WARNING";
  const cashBalance = val(kpis, "cash_balance");
  const netBurn = val(kpis, "monthly_net_burn");

  const factors: RootCauseFactor[] = [{ label: "Cash Runway", kpiCode: "cash_runway_months", value: runway }];
  if (cashBalance != null) factors.push({ label: "現預金", kpiCode: "cash_balance", value: cashBalance });
  if (netBurn != null) factors.push({ label: "月次Burn Rate", kpiCode: "monthly_net_burn", value: netBurn });

  const signalStrength = Math.min(1, (thresholds.cashRunwayWarnMonths - runway) / thresholds.cashRunwayWarnMonths);

  return {
    ruleCode: "DR-17",
    severity,
    title: `法人全体のCash Runwayが${runway.toFixed(1)}ヶ月に低下`,
    problemSummary: `法人全体のCash Runwayが${runway.toFixed(1)}ヶ月まで低下しています。`,
    rootCause: { factors },
    predictedImpact: cashBalance,
    confidence: computeConfidence({ dataCompleteness: cashBalance != null && netBurn != null ? 1 : 0.5, signalStrength }),
    recommendedActions: [
      { title: "コスト削減案の検討", description: "固定費・変動費の見直しにより月次Burnを抑制する。" },
      {
        title: "資金調達（借入）の検討",
        description: "運転資金の借入を含めた資金計画を経営会議で検討する。",
        approvalCategory: "LOAN",
      },
    ],
  };
}
