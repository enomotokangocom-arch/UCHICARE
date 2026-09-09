// Forecast Engine — Phase3本実装。
// 09章「AIによる推測と数式による計算の分離」に従い、ここでは一切LLMを使わず、
// 決定論的な線形回帰(+予測区間)のみで将来値を算出する。予測はUI上 AI ESTIMATE として
// 表示するが、生成ロジック自体は完全に計算(CALCULATED)である点をコード上明示する。
//
// データ粒度が月次のため、Phase1/2で言及していた「月末予測」は当月実績と等価になり
// 意味を持たない。本実装では実務上価値のある「翌月」「3ヶ月後」の予測に絞る。

import { getKpiTrend } from "@/server/uchi-os/kpi-engine/trend";
import { STANDARD_VISIT_MINUTES_PER_MONTH } from "@/server/uchi-os/kpi-engine/constants";
import { forecastLinearWithInterval, type ForecastInterval } from "./simple-forecast";

const FORECAST_TREND_MONTHS = 13;
const FORECAST_KPI_CODES = [
  "monthly_revenue",
  "patient_count",
  "labor_cost",
  "operating_profit",
  "total_visit_minutes",
  "nurse_count",
  "cash_balance",
  "monthly_net_burn",
];

export interface MetricForecast {
  nextMonth: ForecastInterval | null;
  threeMonths: ForecastInterval | null;
}

export interface StationForecast {
  revenue: MetricForecast;
  patientCount: MetricForecast;
  laborCost: MetricForecast;
  operatingProfit: MetricForecast;
  requiredNurses: { nextMonth: number | null; threeMonths: number | null; currentNurses: number | null };
}

function metricForecast(series: (number | null)[]): MetricForecast {
  return {
    nextMonth: forecastLinearWithInterval(series, 1),
    threeMonths: forecastLinearWithInterval(series, 3),
  };
}

/** stationId に null を渡すと法人全体集計を対象にする(getKpiTrendと同じ規約)。 */
export async function computeStationForecast(
  organizationId: string,
  stationId: string | null,
  asOfYearMonth: string,
): Promise<StationForecast> {
  const trend = await getKpiTrend(organizationId, stationId, FORECAST_KPI_CODES, FORECAST_TREND_MONTHS, asOfYearMonth);
  const series = (code: string) => trend.map((p) => p.values[code] ?? null);

  const visitMinutesSeries = series("total_visit_minutes");
  const nurseCountSeries = series("nurse_count");
  const currentNurses = nurseCountSeries[nurseCountSeries.length - 1];

  const forecastMinutes1 = forecastLinearWithInterval(visitMinutesSeries, 1)?.value ?? null;
  const forecastMinutes3 = forecastLinearWithInterval(visitMinutesSeries, 3)?.value ?? null;

  return {
    revenue: metricForecast(series("monthly_revenue")),
    patientCount: metricForecast(series("patient_count")),
    laborCost: metricForecast(series("labor_cost")),
    operatingProfit: metricForecast(series("operating_profit")),
    requiredNurses: {
      nextMonth: forecastMinutes1 != null ? Math.ceil(forecastMinutes1 / STANDARD_VISIT_MINUTES_PER_MONTH) : null,
      threeMonths: forecastMinutes3 != null ? Math.ceil(forecastMinutes3 / STANDARD_VISIT_MINUTES_PER_MONTH) : null,
      currentNurses: currentNurses ?? null,
    },
  };
}

export interface CashRunwayForecast {
  currentCashBalance: number | null;
  averageMonthlyBurn: number | null;
  projectedCashInThreeMonths: number | null;
  projectedRunwayMonthsFromThen: number | null;
}

/**
 * Cash Runwayは回帰ではなく「現預金 − 平均Burn×経過月数」で前進計算する
 * (06章のCash Runway定義と整合させるため、残高自体を線形回帰するより実務的)。
 */
export async function computeCashRunwayForecast(
  organizationId: string,
  asOfYearMonth: string,
): Promise<CashRunwayForecast> {
  const trend = await getKpiTrend(
    organizationId,
    null,
    ["cash_balance", "monthly_net_burn"],
    FORECAST_TREND_MONTHS,
    asOfYearMonth,
  );
  const cashSeries = trend.map((p) => p.values.cash_balance ?? null);
  const burnSeries = trend.map((p) => p.values.monthly_net_burn ?? null);

  const currentCashBalance = cashSeries[cashSeries.length - 1] ?? null;
  const recentBurns = burnSeries.slice(-3).filter((v): v is number => v != null);
  const averageMonthlyBurn = recentBurns.length > 0 ? recentBurns.reduce((a, b) => a + b, 0) / recentBurns.length : null;

  if (currentCashBalance == null || averageMonthlyBurn == null) {
    return { currentCashBalance, averageMonthlyBurn, projectedCashInThreeMonths: null, projectedRunwayMonthsFromThen: null };
  }

  const projectedCashInThreeMonths = currentCashBalance - averageMonthlyBurn * 3;
  const projectedRunwayMonthsFromThen =
    averageMonthlyBurn > 0 ? projectedCashInThreeMonths / averageMonthlyBurn : Number.POSITIVE_INFINITY;

  return { currentCashBalance, averageMonthlyBurn, projectedCashInThreeMonths, projectedRunwayMonthsFromThen };
}
