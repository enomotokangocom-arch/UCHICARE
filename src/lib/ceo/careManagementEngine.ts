import { CEO_CONFIG } from "./config";
import { CareManagementMonthlyMetric, Severity } from "./types";

function severityFromGapRatio(gapRatio: number): Severity {
  if (gapRatio <= -CEO_CONFIG.revenue.redGapRatio) return "red";
  if (gapRatio <= -CEO_CONFIG.revenue.yellowGapRatio) return "yellow";
  return "green";
}

export interface CareManagementForecastResult {
  entityLabel: string;
  month: string;
  forecastCases: number;
  forecastRevenue: number;
  revenueBudget: number;
  gap: number;
  gapRatio: number;
  severity: Severity;
  caseloadPerFte: number;
  caseloadRatio: number; // forecastCaseloadPerFte / targetCaseloadPerFte
  caseloadSeverity: Severity;
}

/**
 * 居宅介護支援の月末売上予測。介護報酬は保有ケース数に対する月額報酬のため、
 * 訪問看護のような日次ランレートではなく「月末時点の保有ケース数見込み × 1件あたり単価」で予測する。
 */
export function forecastCareManagementRevenue(m: CareManagementMonthlyMetric): CareManagementForecastResult {
  const netChange = m.newCases - m.lostCases;
  const forecastCases = Math.max(0, m.currentCases + netChange);
  const forecastRevenue = forecastCases * m.avgFeePerCase;
  const gap = forecastRevenue - m.revenueBudget;
  const gapRatio = m.revenueBudget !== 0 ? gap / m.revenueBudget : 0;

  const caseloadPerFte = m.careManagerCount > 0 ? forecastCases / m.careManagerCount : 0;
  const caseloadRatio = m.targetCaseloadPerFte > 0 ? caseloadPerFte / m.targetCaseloadPerFte : 0;
  let caseloadSeverity: Severity = "green";
  if (caseloadRatio >= CEO_CONFIG.careManagement.redCaseloadRatio) caseloadSeverity = "red";
  else if (caseloadRatio >= CEO_CONFIG.careManagement.yellowCaseloadRatio) caseloadSeverity = "yellow";

  return {
    entityLabel: m.office,
    month: m.month,
    forecastCases: Math.round(forecastCases),
    forecastRevenue: Math.round(forecastRevenue),
    revenueBudget: Math.round(m.revenueBudget),
    gap: Math.round(gap),
    gapRatio,
    severity: severityFromGapRatio(gapRatio),
    caseloadPerFte: Math.round(caseloadPerFte * 10) / 10,
    caseloadRatio,
    caseloadSeverity,
  };
}

export interface CareManagementProfitResult {
  entityLabel: string;
  month: string;
  forecastRevenue: number;
  laborCost: number;
  fixedCost: number;
  forecastProfit: number;
  profitBudget: number;
  gap: number;
  severity: Severity;
}

export function forecastCareManagementProfit(m: CareManagementMonthlyMetric): CareManagementProfitResult {
  const revenue = forecastCareManagementRevenue(m);
  const forecastProfit = revenue.forecastRevenue - m.laborCost - m.fixedCost;
  const gap = forecastProfit - m.profitBudget;
  const gapRatio = m.profitBudget !== 0 ? gap / Math.abs(m.profitBudget) : 0;

  return {
    entityLabel: m.office,
    month: m.month,
    forecastRevenue: revenue.forecastRevenue,
    laborCost: m.laborCost,
    fixedCost: m.fixedCost,
    forecastProfit: Math.round(forecastProfit),
    profitBudget: Math.round(m.profitBudget),
    gap: Math.round(gap),
    severity: severityFromGapRatio(gapRatio),
  };
}
