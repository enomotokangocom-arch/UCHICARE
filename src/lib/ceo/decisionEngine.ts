import { CEO_CONFIG } from "./config";
import {
  buildHiringDecision,
  buildProductivityDecision,
  buildProfitDecision,
  buildProfitDecisionFromForecast,
  buildRequiredSalesDecision,
  buildRevenueDecision,
  buildRevenueDecisionFromForecast,
  buildUtilizationDecision,
} from "./decisionBuilders";
import { severityRank } from "./decisionHelpers";
import { forecastCompanyProfit, forecastCompanyRevenue } from "./forecastEngine";
import { branchUtilization, scoreAllNurses } from "./productivityEngine";
import { branchSeries } from "./salesEngine";
import { BRANCHES, BranchMonthlyMetric, CeoDataset, Decision } from "./types";

export function latestPerBranch(metrics: BranchMonthlyMetric[]): BranchMonthlyMetric[] {
  const currentMonth = metrics.reduce((max, m) => (m.month > max ? m.month : max), "");
  return BRANCHES.map((b) => metrics.find((m) => m.branch === b && m.month === currentMonth)).filter(
    (m): m is BranchMonthlyMetric => Boolean(m)
  );
}

export interface DecisionBuildResult {
  /** 今日CEOが判断すべきこと(severity!=green の上位 maxTopDecisions 件)。 */
  topDecisions: Decision[];
  /** 深刻度はあるが優先度で上位に入らなかった項目(CEOへの通知は絞るが、監視は継続)。 */
  watchList: Decision[];
  /** 異常なし・AIが監視のみで完結している項目(「AIが処理済み」セクション用)。 */
  okDecisions: Decision[];
  allDecisions: Decision[];
}

/** 全Decisionルールを評価し、優先順位付けして返す(Decision Engineのエントリポイント)。 */
export function buildDecisions(dataset: CeoDataset, today: Date = new Date()): DecisionBuildResult {
  const now = today.toISOString();
  const latest = latestPerBranch(dataset.branchMetrics);
  const nurseScores = scoreAllNurses(dataset.nurseProductivity.filter((r) => r.month === latest[0]?.month));

  const decisions: Decision[] = [];

  const companyRevenue = forecastCompanyRevenue(latest);
  const companyProfit = forecastCompanyProfit(latest);
  decisions.push(buildRevenueDecisionFromForecast(companyRevenue, "company", "company", "全社", now));
  decisions.push(buildProfitDecisionFromForecast(companyProfit, "company", "company", "全社", now));

  latest.forEach((m) => {
    const revenueDecision = buildRevenueDecision(m, "branch", m.branch, m.branch, now);
    if (revenueDecision.severity !== "green") decisions.push(revenueDecision);

    const profitDecision = buildProfitDecision(m, "branch", m.branch, m.branch, now);
    if (profitDecision.severity !== "green") decisions.push(profitDecision);

    const productivityDecision = buildProductivityDecision(m.branch, nurseScores, now);
    if (productivityDecision) decisions.push(productivityDecision);

    const salesDecision = buildRequiredSalesDecision(m, now);
    if (salesDecision && salesDecision.severity !== "green") decisions.push(salesDecision);

    const util = branchUtilization(m);
    if (util.severity !== "green") {
      decisions.push(buildUtilizationDecision(m, util.utilizationRate, util.severity, now));
    }

    const series = branchSeries(dataset.branchMetrics, m.branch);
    const hiringDecision = buildHiringDecision(series, now, today);
    if (hiringDecision) decisions.push(hiringDecision);
  });

  const sorted = [...decisions].sort((a, b) => {
    if (severityRank(b.severity) !== severityRank(a.severity)) return severityRank(b.severity) - severityRank(a.severity);
    return b.priorityScore - a.priorityScore;
  });

  const nonGreen = sorted.filter((d) => d.severity !== "green");
  const topDecisions = nonGreen.slice(0, CEO_CONFIG.maxTopDecisions);
  const watchList = nonGreen.slice(CEO_CONFIG.maxTopDecisions);
  const okDecisions = sorted.filter((d) => d.severity === "green");

  return { topDecisions, watchList, okDecisions, allDecisions: sorted };
}
