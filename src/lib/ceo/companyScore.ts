import { CEO_CONFIG } from "./config";
import { CompanyHealthBreakdown, Decision } from "./types";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export interface CompanyScoreInput {
  forecastRevenue: number;
  revenueBudget: number;
  forecastProfit: number;
  profitBudget: number;
  /** 訪問看護・通所介護(UCHINOWA)の稼働率をまとめて渡す(健康経営Uchi Well・居宅介護支援は稼働率の概念を持たないため含めない)。 */
  utilizationRates: number[];
  decisions: Decision[];
}

/** 会社状態スコア(0〜100)。全事業ライン横断の売上・利益達成度、稼働率、Decisionの深刻度で構成。 */
export function computeCompanyHealthScore(input: CompanyScoreInput): CompanyHealthBreakdown {
  const revenueAttainment = input.revenueBudget > 0 ? input.forecastRevenue / input.revenueBudget : 1;
  const profitAttainment = input.profitBudget !== 0 ? input.forecastProfit / input.profitBudget : 1;

  const avgUtilization =
    input.utilizationRates.length > 0
      ? input.utilizationRates.reduce((a, b) => a + b, 0) / input.utilizationRates.length
      : 0;

  const redCount = input.decisions.filter((d) => d.severity === "red").length;
  const yellowCount = input.decisions.filter((d) => d.severity === "yellow").length;
  const severityPenalty = clamp(redCount * 0.18 + yellowCount * 0.08, 0, 1);

  const revenueComponent = (CEO_CONFIG.companyScore.revenueWeight * clamp(revenueAttainment, 0, 1.1)) / 1.1;
  const profitComponent = (CEO_CONFIG.companyScore.profitWeight * clamp(profitAttainment, 0, 1.1)) / 1.1;
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
