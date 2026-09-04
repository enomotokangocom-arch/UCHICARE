import { CEO_CONFIG } from "./config";
import { forecastCompanyProfit, forecastCompanyRevenue } from "./forecastEngine";
import { branchUtilization } from "./productivityEngine";
import { BranchMonthlyMetric, CompanyHealthBreakdown, Decision } from "./types";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** 会社状態スコア(0〜100)。売上・利益達成度、稼働率、Decisionの深刻度で構成。 */
export function computeCompanyHealthScore(
  latestMetrics: BranchMonthlyMetric[],
  decisions: Decision[]
): CompanyHealthBreakdown {
  const revenue = forecastCompanyRevenue(latestMetrics);
  const profit = forecastCompanyProfit(latestMetrics);

  const revenueAttainment = revenue.revenueBudget > 0 ? revenue.forecastRevenue / revenue.revenueBudget : 1;
  const profitAttainment = profit.profitBudget !== 0 ? profit.forecastProfit / profit.profitBudget : 1;

  const utilizations = latestMetrics.map((m) => branchUtilization(m).utilizationRate);
  const avgUtilization = utilizations.length > 0 ? utilizations.reduce((a, b) => a + b, 0) / utilizations.length : 0;

  const redCount = decisions.filter((d) => d.severity === "red").length;
  const yellowCount = decisions.filter((d) => d.severity === "yellow").length;
  const severityPenalty = clamp(redCount * 0.18 + yellowCount * 0.08, 0, 1);

  const revenueComponent = CEO_CONFIG.companyScore.revenueWeight * clamp(revenueAttainment, 0, 1.1) / 1.1;
  const profitComponent = CEO_CONFIG.companyScore.profitWeight * clamp(profitAttainment, 0, 1.1) / 1.1;
  const utilizationComponent =
    CEO_CONFIG.companyScore.utilizationWeight * clamp(avgUtilization / CEO_CONFIG.utilization.targetRate, 0, 1);
  const severityComponent = CEO_CONFIG.companyScore.severityWeight * (1 - severityPenalty);

  const score = Math.round(revenueComponent + profitComponent + utilizationComponent + severityComponent);

  return {
    score: clamp(score, 0, 100),
    revenueComponent: Math.round(revenueComponent),
    profitComponent: Math.round(profitComponent),
    utilizationComponent: Math.round(utilizationComponent),
    severityComponent: Math.round(severityComponent),
  };
}
