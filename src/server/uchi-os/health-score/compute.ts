// Uchi OS SCORE — 5章「経営Health Score」の実装。
// 単純平均ではなく、経営へのインパクトを加味した加重スコアとする。
// 各カテゴリのデータが欠損している場合は、そのカテゴリを重み計算から除外する(数字を創作しない、06.8節)。

import { computeMonthlyKpis } from "@/server/uchi-os/kpi-engine/compute";
import { shiftYearMonth } from "@/server/uchi-os/kpi-engine/dates";

export const HEALTH_SCORE_CATEGORIES = [
  { key: "revenue", label: "売上", weight: 0.2 },
  { key: "profit", label: "利益", weight: 0.2 },
  { key: "productivity", label: "生産性", weight: 0.15 },
  { key: "sales", label: "営業", weight: 0.15 },
  { key: "recruitment", label: "採用", weight: 0.1 },
  { key: "organization", label: "組織", weight: 0.1 },
  { key: "cash", label: "キャッシュ", weight: 0.1 },
] as const;

export type HealthScoreCategoryKey = (typeof HEALTH_SCORE_CATEGORIES)[number]["key"];

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

// ベンチマーク値。Phase2でSettingsから組織別に調整可能にする想定 (07章冒頭の「ハードコード禁止」方針に対する既知の簡略化)。
const BENCHMARK_REVENUE_PER_NURSE = 800_000;
const BENCHMARK_REFERRAL_RATE_PCT = 30;
const BENCHMARK_IDEAL_UTILIZATION_PCT = 80;
const BENCHMARK_CASH_RUNWAY_MONTHS = 12;

function scoreRevenue(revenueMoM: number | null): number | null {
  if (revenueMoM == null) return null;
  return clamp(revenueMoM >= 0 ? 80 + revenueMoM * 2 : 80 + revenueMoM * 3);
}

function scoreProfit(operatingProfitMargin: number | null): number | null {
  if (operatingProfitMargin == null) return null;
  return clamp(50 + operatingProfitMargin * 3.33);
}

function scoreProductivity(revenuePerNurse: number | null): number | null {
  if (revenuePerNurse == null) return null;
  return clamp((revenuePerNurse / BENCHMARK_REVENUE_PER_NURSE) * 100);
}

function scoreSales(referralRate: number | null): number | null {
  if (referralRate == null) return null;
  return clamp((referralRate / BENCHMARK_REFERRAL_RATE_PCT) * 100);
}

function scoreRecruitment(turnoverRate: number | null): number | null {
  if (turnoverRate == null) return null;
  return clamp(100 - turnoverRate * 10);
}

function scoreOrganization(utilizationRate: number | null): number | null {
  if (utilizationRate == null) return null;
  return clamp(100 - Math.abs(utilizationRate - BENCHMARK_IDEAL_UTILIZATION_PCT) * 2);
}

function scoreCash(cashRunwayMonths: number | null): number | null {
  if (cashRunwayMonths == null) return null;
  if (!Number.isFinite(cashRunwayMonths)) return 100; // 黒字基調 (formulas.cashRunwayMonths のInfinity特別値)
  return clamp((cashRunwayMonths / BENCHMARK_CASH_RUNWAY_MONTHS) * 100);
}

export interface HealthScoreBreakdown {
  key: HealthScoreCategoryKey;
  label: string;
  score: number | null;
}

export interface HealthScoreResult {
  overall: number | null;
  breakdown: HealthScoreBreakdown[];
}

async function computeHealthScoreForMonth(organizationId: string, yearMonth: string): Promise<HealthScoreResult> {
  const kpis = new Map((await computeMonthlyKpis(organizationId, null, yearMonth)).map((e) => [e.kpiCode, e]));
  const get = (code: string) => {
    const entry = kpis.get(code);
    return entry && !entry.insufficientData ? entry.value : null;
  };

  const scores: Record<HealthScoreCategoryKey, number | null> = {
    revenue: scoreRevenue(get("revenue_mom")),
    profit: scoreProfit(get("operating_profit_margin")),
    productivity: scoreProductivity(get("revenue_per_nurse")),
    sales: scoreSales(get("referral_rate")),
    recruitment: scoreRecruitment(get("turnover_rate")),
    organization: scoreOrganization(get("utilization_rate")),
    cash: scoreCash(get("cash_runway_months")),
  };

  const breakdown: HealthScoreBreakdown[] = HEALTH_SCORE_CATEGORIES.map((c) => ({
    key: c.key,
    label: c.label,
    score: scores[c.key],
  }));

  let weightedSum = 0;
  let totalWeight = 0;
  for (const category of HEALTH_SCORE_CATEGORIES) {
    const score = scores[category.key];
    if (score == null) continue;
    weightedSum += score * category.weight;
    totalWeight += category.weight;
  }

  const overall = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : null;
  return { overall, breakdown };
}

export interface HealthScoreWithTrend extends HealthScoreResult {
  previousOverall: number | null;
  delta: number | null;
}

export async function computeHealthScore(organizationId: string, yearMonth: string): Promise<HealthScoreWithTrend> {
  const [current, previous] = await Promise.all([
    computeHealthScoreForMonth(organizationId, yearMonth),
    computeHealthScoreForMonth(organizationId, shiftYearMonth(yearMonth, -1)),
  ]);

  const delta = current.overall != null && previous.overall != null ? current.overall - previous.overall : null;

  return { ...current, previousOverall: previous.overall, delta };
}
