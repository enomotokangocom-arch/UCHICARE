import { CEO_CONFIG } from "./config";
import { CorporateHealthMonthlyMetric, Severity } from "./types";

function severityFromGapRatio(gapRatio: number): Severity {
  if (gapRatio <= -CEO_CONFIG.revenue.redGapRatio) return "red";
  if (gapRatio <= -CEO_CONFIG.revenue.yellowGapRatio) return "yellow";
  return "green";
}

export interface CorporateHealthForecastResult {
  entityLabel: string;
  month: string;
  forecastContracts: number;
  forecastRevenue: number;
  revenueBudget: number;
  gap: number;
  gapRatio: number;
  severity: Severity;
  churnRatio: number; // lostContracts / currentContracts
  churnSeverity: Severity;
}

/**
 * 健康経営サービス(Uchi Well)の月末売上予測。法人契約は月額/年額の定額契約のため、
 * 訪問看護のような日次ランレートではなく「月末時点の契約社数見込み × 1社あたり契約単価」で予測する。
 */
export function forecastCorporateHealthRevenue(m: CorporateHealthMonthlyMetric): CorporateHealthForecastResult {
  const netChange = m.newContracts - m.lostContracts;
  const forecastContracts = Math.max(0, m.currentContracts + netChange);
  const forecastRevenue = forecastContracts * m.avgContractFeePerMonth;
  const gap = forecastRevenue - m.revenueBudget;
  const gapRatio = m.revenueBudget !== 0 ? gap / m.revenueBudget : 0;

  const churnRatio = m.currentContracts > 0 ? m.lostContracts / m.currentContracts : 0;
  let churnSeverity: Severity = "green";
  if (churnRatio >= CEO_CONFIG.corporateHealth.redChurnRatio) churnSeverity = "red";
  else if (churnRatio >= CEO_CONFIG.corporateHealth.yellowChurnRatio) churnSeverity = "yellow";

  return {
    entityLabel: m.office,
    month: m.month,
    forecastContracts: Math.round(forecastContracts),
    forecastRevenue: Math.round(forecastRevenue),
    revenueBudget: Math.round(m.revenueBudget),
    gap: Math.round(gap),
    gapRatio,
    severity: severityFromGapRatio(gapRatio),
    churnRatio,
    churnSeverity,
  };
}

export interface CorporateHealthProfitResult {
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

export function forecastCorporateHealthProfit(m: CorporateHealthMonthlyMetric): CorporateHealthProfitResult {
  const revenue = forecastCorporateHealthRevenue(m);
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
