import { CEO_CONFIG } from "./config";
import { DayServiceMonthlyMetric, Severity } from "./types";

function severityFromGapRatio(gapRatio: number): Severity {
  if (gapRatio <= -CEO_CONFIG.revenue.redGapRatio) return "red";
  if (gapRatio <= -CEO_CONFIG.revenue.yellowGapRatio) return "yellow";
  return "green";
}

export interface DayServiceForecastResult {
  entityLabel: string;
  month: string;
  confirmedAttendance: number;
  scheduledAttendance: number;
  forecastAttendance: number;
  forecastRevenue: number;
  revenueBudget: number;
  gap: number;
  gapRatio: number;
  severity: Severity;
  utilizationRate: number; // MTD延べ利用者数 / MTD受入可能延べ人数
  utilizationSeverity: Severity;
}

/**
 * 通所介護の月末売上予測。個人の訪問時間ではなく「1日あたり定員 × 営業日数」で決まる
 * 受け入れ可能延べ人数(キャパシティ)に対する稼働率をもとに、訪問看護と同様の
 * 日次ランレート方式で残り営業日分の利用見込みを積み上げる。
 */
export function forecastDayServiceRevenue(m: DayServiceMonthlyMetric): DayServiceForecastResult {
  const operatingDaysElapsed =
    m.daysElapsed > 0 ? Math.round((m.operatingDays * m.daysElapsed) / m.daysInMonth) : 0;
  const capacityMtd = m.capacityPerDay * operatingDaysElapsed;
  const utilizationRate = capacityMtd > 0 ? m.attendanceMtd / capacityMtd : 0;

  const remainingOperatingDays = m.operatingDays - operatingDaysElapsed;
  const scheduledAttendance =
    operatingDaysElapsed > 0 ? (m.attendanceMtd / operatingDaysElapsed) * remainingOperatingDays : 0;
  const forecastAttendance = m.attendanceMtd + scheduledAttendance;
  const forecastRevenue = forecastAttendance * m.avgFeePerAttendance;

  const gap = forecastRevenue - m.revenueBudget;
  const gapRatio = m.revenueBudget !== 0 ? gap / m.revenueBudget : 0;

  let utilizationSeverity: Severity = "green";
  if (utilizationRate < CEO_CONFIG.dayService.redUtilization) utilizationSeverity = "red";
  else if (utilizationRate < CEO_CONFIG.dayService.yellowUtilization) utilizationSeverity = "yellow";

  return {
    entityLabel: m.office,
    month: m.month,
    confirmedAttendance: m.attendanceMtd,
    scheduledAttendance: Math.round(scheduledAttendance),
    forecastAttendance: Math.round(forecastAttendance),
    forecastRevenue: Math.round(forecastRevenue),
    revenueBudget: Math.round(m.revenueBudget),
    gap: Math.round(gap),
    gapRatio,
    severity: severityFromGapRatio(gapRatio),
    utilizationRate,
    utilizationSeverity,
  };
}

export interface DayServiceProfitResult {
  entityLabel: string;
  month: string;
  forecastRevenue: number;
  laborCost: number;
  variableCost: number;
  fixedCost: number;
  forecastProfit: number;
  profitBudget: number;
  gap: number;
  severity: Severity;
}

export function forecastDayServiceProfit(m: DayServiceMonthlyMetric): DayServiceProfitResult {
  const revenue = forecastDayServiceRevenue(m);
  const forecastProfit = revenue.forecastRevenue - m.laborCost - m.variableCost - m.fixedCost;
  const gap = forecastProfit - m.profitBudget;
  const gapRatio = m.profitBudget !== 0 ? gap / Math.abs(m.profitBudget) : 0;

  return {
    entityLabel: m.office,
    month: m.month,
    forecastRevenue: revenue.forecastRevenue,
    laborCost: m.laborCost,
    variableCost: m.variableCost,
    fixedCost: m.fixedCost,
    forecastProfit: Math.round(forecastProfit),
    profitBudget: Math.round(m.profitBudget),
    gap: Math.round(gap),
    severity: severityFromGapRatio(gapRatio),
  };
}
