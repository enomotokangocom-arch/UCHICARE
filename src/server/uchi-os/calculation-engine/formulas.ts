// Calculation Engine — 06章 KPI Definition Table の決定論的な計算式。
// 副作用のない純粋関数のみで構成する (04章のレイヤー分離、13.7節)。
// DB・LLMには一切依存しない。ゼロ除算・欠損値の扱いは 06.8節 に準拠。

import { ok, safeDivide, insufficient, type KpiResult } from "./types";

// ---------- 売上系 ----------

export function revenueMoM(current: number | null, previous: number | null): KpiResult {
  if (current == null || previous == null) return insufficient;
  return safeDivide(current - previous, previous, 100);
}

export function revenueYoY(current: number | null, previousYear: number | null): KpiResult {
  return revenueMoM(current, previousYear);
}

export function revenuePerNurse(revenue: number | null, nurseFte: number | null): KpiResult {
  return safeDivide(revenue, nurseFte);
}

// ---------- 利用者系 ----------

export function netPatientChange(newPatients: number, endedPatients: number): KpiResult {
  return ok(newPatients - endedPatients);
}

export function newToStartRate(startedVisitCount: number, newPatients: number): KpiResult {
  return safeDivide(startedVisitCount, newPatients, 100);
}

export function avgCareDurationDays(durationsInDays: number[]): KpiResult {
  if (durationsInDays.length === 0) return insufficient;
  const sum = durationsInDays.reduce((a, b) => a + b, 0);
  return ok(sum / durationsInDays.length);
}

// ---------- 訪問系 ----------

/** standardAvailableMinutes = FTE合計 × 契約労働時間(分) × 稼働日数 で呼び出し側が算出する。 */
export function utilizationRate(actualVisitMinutes: number | null, standardAvailableMinutes: number | null): KpiResult {
  return safeDivide(actualVisitMinutes, standardAvailableMinutes, 100);
}

export function visitMinutesPerNurse(totalVisitMinutes: number | null, nurseFte: number | null): KpiResult {
  return safeDivide(totalVisitMinutes, nurseFte);
}

/** 07章 DR-07 過稼働判定の補助指標。個人の訪問時間 ÷ 拠点看護師の平均訪問時間。 */
export function employeeWorkloadIndex(employeeMinutes: number | null, stationAverageMinutes: number | null): KpiResult {
  return safeDivide(employeeMinutes, stationAverageMinutes);
}

// ---------- 人員系 ----------

export function totalFte(fteList: number[]): KpiResult {
  if (fteList.length === 0) return ok(0);
  return ok(fteList.reduce((a, b) => a + b, 0));
}

export function turnoverRate(resignations: number, headcountAtStart: number | null): KpiResult {
  return safeDivide(resignations, headcountAtStart, 100);
}

// ---------- 財務系 ----------

export function laborCostRatio(laborCost: number | null, revenue: number | null): KpiResult {
  return safeDivide(laborCost, revenue, 100);
}

export function operatingProfit(
  revenue: number | null,
  laborCost: number | null,
  otherFixedCost: number | null,
  otherVariableCost: number | null,
): KpiResult {
  if (revenue == null || laborCost == null) return insufficient;
  return ok(revenue - laborCost - (otherFixedCost ?? 0) - (otherVariableCost ?? 0));
}

export function operatingProfitMargin(operatingProfitValue: number | null, revenue: number | null): KpiResult {
  return safeDivide(operatingProfitValue, revenue, 100);
}

/** 減価償却費はPhase1では未モデル化のため0扱い。将来 otherFixedCost の内訳として拡張する (06.5節)。 */
export function ebitda(operatingProfitValue: number | null, depreciation = 0): KpiResult {
  if (operatingProfitValue == null) return insufficient;
  return ok(operatingProfitValue + depreciation);
}

/** 黒字月(支出<=収入)は0を返す。 */
export function monthlyNetBurn(totalExpense: number | null, totalIncome: number | null): KpiResult {
  if (totalExpense == null || totalIncome == null) return insufficient;
  return ok(Math.max(0, totalExpense - totalIncome));
}

/**
 * Cash Runway (月)。直近3ヶ月平均Burnが0以下(黒字基調)の場合は Infinity を「Runway良好」の
 * 特別値として返す。呼び出し側UIは Infinity を「Runway良好(黒字基調)」と表示する (06.8節)。
 */
export function cashRunwayMonths(cashBalance: number | null, avgMonthlyNetBurn: number | null): KpiResult {
  if (cashBalance == null || avgMonthlyNetBurn == null) return insufficient;
  if (avgMonthlyNetBurn <= 0) return ok(Number.POSITIVE_INFINITY);
  return ok(cashBalance / avgMonthlyNetBurn);
}

// ---------- 営業系 ----------

export function referralRate(referralCount: number | null, salesActivityCount: number | null): KpiResult {
  return safeDivide(referralCount, salesActivityCount, 100);
}

export function salesRoi(incrementalRevenue: number | null, activityCost: number | null): KpiResult {
  return safeDivide(incrementalRevenue, activityCost);
}

// ---------- 追加KPI (06.7節) ----------

export function stationOperatingProfit(
  stationRevenue: number | null,
  allocatedLaborCost: number | null,
  stationFixedCost: number | null,
): KpiResult {
  if (stationRevenue == null || allocatedLaborCost == null) return insufficient;
  return ok(stationRevenue - allocatedLaborCost - (stationFixedCost ?? 0));
}

export function referralSourceDormancyDays(lastVisitDate: Date | null, asOf: Date): KpiResult {
  if (!lastVisitDate) return insufficient;
  const diffMs = asOf.getTime() - lastVisitDate.getTime();
  return ok(Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}
