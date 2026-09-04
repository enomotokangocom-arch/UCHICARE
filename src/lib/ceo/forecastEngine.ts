import { CEO_CONFIG } from "./config";
import { BranchMonthlyMetric, Severity } from "./types";

export interface RevenueForecastResult {
  entityLabel: string; // 拠点名 or "全社"
  month: string;
  confirmedRevenue: number;
  scheduledVisitRevenue: number;
  expectedNewPatientRevenue: number;
  expectedResumptionRevenue: number;
  expectedDischargeImpact: number;
  expectedHospitalizationImpact: number;
  expectedCancellationImpact: number;
  expectedAddons: number;
  forecastRevenue: number;
  revenueBudget: number;
  gap: number;
  gapRatio: number;
  achievementProbability: number;
  severity: Severity;
}

export interface ProfitForecastResult {
  entityLabel: string;
  month: string;
  forecastRevenue: number;
  laborCost: number;
  variableCost: number;
  fixedCost: number;
  forecastProfit: number;
  profitBudget: number;
  gap: number;
  revenueShortfallComponent: number;
  laborOverrunComponent: number;
  otherFixedOverrunComponent: number;
  severity: Severity;
}

function severityFromGapRatio(gapRatio: number): Severity {
  if (gapRatio <= -CEO_CONFIG.revenue.redGapRatio) return "red";
  if (gapRatio <= -CEO_CONFIG.revenue.yellowGapRatio) return "yellow";
  return "green";
}

/** 月末売上予測(1拠点分)。数値のみで構成される決定的ロジック(LLM不使用)。 */
export function forecastBranchRevenue(m: BranchMonthlyMetric): RevenueForecastResult {
  const remainingRatio = m.daysElapsed > 0 ? (m.daysInMonth - m.daysElapsed) / m.daysInMonth : 0;
  const confirmedRevenue = m.revenueActualMtd;
  const scheduledVisitRevenue = m.daysElapsed > 0 ? (m.revenueActualMtd / m.daysElapsed) * (m.daysInMonth - m.daysElapsed) : 0;

  const expectedNewPatientRevenue = m.newPatients * m.avgRevenuePerPatient * remainingRatio;
  const expectedResumptionRevenue = m.resumedPatients * m.avgRevenuePerPatient * remainingRatio;
  const expectedDischargeImpact = m.dischargedPatients * m.avgRevenuePerPatient * remainingRatio;
  const expectedHospitalizationImpact =
    m.hospitalizedPatients * m.avgRevenuePerPatient * CEO_CONFIG.revenue.hospitalizationImpactFactor * remainingRatio;
  const expectedCancellationImpact = scheduledVisitRevenue * CEO_CONFIG.revenue.cancellationRate;
  const expectedAddons = scheduledVisitRevenue * CEO_CONFIG.revenue.addonRate;

  const forecastRevenue =
    confirmedRevenue +
    scheduledVisitRevenue +
    expectedNewPatientRevenue +
    expectedResumptionRevenue -
    expectedDischargeImpact -
    expectedHospitalizationImpact -
    expectedCancellationImpact +
    expectedAddons;

  const gap = forecastRevenue - m.revenueBudget;
  const gapRatio = m.revenueBudget !== 0 ? gap / m.revenueBudget : 0;
  const achievementProbability = Math.min(0.95, Math.max(0.05, 0.5 + gapRatio * 5));

  return {
    entityLabel: m.branch,
    month: m.month,
    confirmedRevenue: Math.round(confirmedRevenue),
    scheduledVisitRevenue: Math.round(scheduledVisitRevenue),
    expectedNewPatientRevenue: Math.round(expectedNewPatientRevenue),
    expectedResumptionRevenue: Math.round(expectedResumptionRevenue),
    expectedDischargeImpact: Math.round(expectedDischargeImpact),
    expectedHospitalizationImpact: Math.round(expectedHospitalizationImpact),
    expectedCancellationImpact: Math.round(expectedCancellationImpact),
    expectedAddons: Math.round(expectedAddons),
    forecastRevenue: Math.round(forecastRevenue),
    revenueBudget: Math.round(m.revenueBudget),
    gap: Math.round(gap),
    gapRatio,
    achievementProbability,
    severity: severityFromGapRatio(gapRatio),
  };
}

/** 全社集計(拠点別予測を合算)。 */
export function forecastCompanyRevenue(metrics: BranchMonthlyMetric[]): RevenueForecastResult {
  const perBranch = metrics.map(forecastBranchRevenue);
  const sum = (key: keyof RevenueForecastResult) =>
    perBranch.reduce((acc, r) => acc + (typeof r[key] === "number" ? (r[key] as number) : 0), 0);

  const forecastRevenue = sum("forecastRevenue");
  const revenueBudget = sum("revenueBudget");
  const gap = forecastRevenue - revenueBudget;
  const gapRatio = revenueBudget !== 0 ? gap / revenueBudget : 0;

  return {
    entityLabel: "全社",
    month: metrics[0]?.month ?? "",
    confirmedRevenue: sum("confirmedRevenue"),
    scheduledVisitRevenue: sum("scheduledVisitRevenue"),
    expectedNewPatientRevenue: sum("expectedNewPatientRevenue"),
    expectedResumptionRevenue: sum("expectedResumptionRevenue"),
    expectedDischargeImpact: sum("expectedDischargeImpact"),
    expectedHospitalizationImpact: sum("expectedHospitalizationImpact"),
    expectedCancellationImpact: sum("expectedCancellationImpact"),
    expectedAddons: sum("expectedAddons"),
    forecastRevenue,
    revenueBudget,
    gap,
    gapRatio,
    achievementProbability: Math.min(0.95, Math.max(0.05, 0.5 + gapRatio * 5)),
    severity: severityFromGapRatio(gapRatio),
  };
}

/** 月末利益予測(1拠点分)。 */
export function forecastBranchProfit(m: BranchMonthlyMetric): ProfitForecastResult {
  const revenue = forecastBranchRevenue(m);
  const actualTotalCost = m.laborCost + m.variableCost + m.fixedCost;
  const forecastProfit = revenue.forecastRevenue - actualTotalCost;
  const gap = forecastProfit - m.profitBudget;

  // gap = revenueGap - costOverrun (costOverrun = 実コスト - 計画コスト) に分解し、
  // costOverrun をさらに人件費/その他固定費に按分する。
  const budgetedTotalCost = m.revenueBudget - m.profitBudget;
  const costOverrun = actualTotalCost - budgetedTotalCost;
  const laborShare = actualTotalCost !== 0 ? m.laborCost / actualTotalCost : 0;

  const revenueShortfallComponent = revenue.gap;
  const laborOverrunComponent = -costOverrun * laborShare;
  const otherFixedOverrunComponent = -costOverrun * (1 - laborShare);

  const gapRatio = m.profitBudget !== 0 ? gap / Math.abs(m.profitBudget) : 0;

  return {
    entityLabel: m.branch,
    month: m.month,
    forecastRevenue: revenue.forecastRevenue,
    laborCost: m.laborCost,
    variableCost: m.variableCost,
    fixedCost: m.fixedCost,
    forecastProfit: Math.round(forecastProfit),
    profitBudget: Math.round(m.profitBudget),
    gap: Math.round(gap),
    revenueShortfallComponent: Math.round(revenueShortfallComponent),
    laborOverrunComponent: Math.round(laborOverrunComponent),
    otherFixedOverrunComponent: Math.round(otherFixedOverrunComponent),
    severity: severityFromGapRatio(gapRatio),
  };
}

export function forecastCompanyProfit(metrics: BranchMonthlyMetric[]): ProfitForecastResult {
  const perBranch = metrics.map(forecastBranchProfit);
  const sum = (key: keyof ProfitForecastResult) =>
    perBranch.reduce((acc, r) => acc + (typeof r[key] === "number" ? (r[key] as number) : 0), 0);

  const forecastProfit = sum("forecastProfit");
  const profitBudget = sum("profitBudget");
  const gap = forecastProfit - profitBudget;
  const gapRatio = profitBudget !== 0 ? gap / Math.abs(profitBudget) : 0;

  return {
    entityLabel: "全社",
    month: metrics[0]?.month ?? "",
    forecastRevenue: sum("forecastRevenue"),
    laborCost: sum("laborCost"),
    variableCost: sum("variableCost"),
    fixedCost: sum("fixedCost"),
    forecastProfit,
    profitBudget,
    gap,
    revenueShortfallComponent: sum("revenueShortfallComponent"),
    laborOverrunComponent: sum("laborOverrunComponent"),
    otherFixedOverrunComponent: sum("otherFixedOverrunComponent"),
    severity: severityFromGapRatio(gapRatio),
  };
}
