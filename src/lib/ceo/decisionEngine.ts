import { CEO_CONFIG } from "./config";
import { computeCompanyAggregate } from "./companyAggregate";
import {
  buildCaseloadDecision,
  buildCareManagementProfitDecision,
  buildCareManagementRevenueDecision,
  buildChurnRiskDecision,
  buildCompanyProfitDecision,
  buildCompanyRevenueDecision,
  buildCorporateHealthProfitDecision,
  buildCorporateHealthRevenueDecision,
  buildDayServiceProfitDecision,
  buildDayServiceRevenueDecision,
  buildDayServiceUtilizationDecision,
  buildHiringDecision,
  buildProductivityDecision,
  buildProfitDecision,
  buildRequiredSalesDecision,
  buildRevenueDecision,
  buildUtilizationDecision,
} from "./decisionBuilders";
import { severityRank } from "./decisionHelpers";
import { branchUtilization, scoreAllNurses } from "./productivityEngine";
import { branchSeries } from "./salesEngine";
import { BranchMonthlyMetric, CeoDataset, Decision } from "./types";

function latestByKey<T extends { month: string }>(items: T[], keyOf: (item: T) => string): T[] {
  const currentMonth = items.reduce((max, i) => (i.month > max ? i.month : max), "");
  const keys = Array.from(new Set(items.map(keyOf)));
  return keys.map((k) => items.find((i) => keyOf(i) === k && i.month === currentMonth)).filter((i): i is T => Boolean(i));
}

/** dataset内に実在する拠点名から、各拠点の最新月のレコードを取り出す(訪問看護)。 */
export function latestPerBranch(metrics: BranchMonthlyMetric[]): BranchMonthlyMetric[] {
  return latestByKey(metrics, (m) => m.branch);
}

export function latestPerOffice<T extends { month: string; office: string }>(metrics: T[]): T[] {
  return latestByKey(metrics, (m) => m.office);
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

/** 全Decisionルールを評価し、優先順位付けして返す(Decision Engineのエントリポイント)。4事業ライン
 * (訪問看護/健康経営Uchi Well/居宅介護支援/通所介護UCHINOWA)すべてを横断して1つのリストにまとめる。 */
export function buildDecisions(dataset: CeoDataset, today: Date = new Date()): DecisionBuildResult {
  const now = today.toISOString();
  const latest = latestPerBranch(dataset.branchMetrics); // 訪問看護3拠点
  const chLatest = latestPerOffice(dataset.corporateHealthMetrics); // 健康経営サービス(Uchi Well)
  const cmLatest = latestPerOffice(dataset.careManagementMetrics); // 居宅介護支援
  const dsLatest = latestPerOffice(dataset.dayServiceMetrics); // 通所介護(UCHINOWA)
  const nurseScores = scoreAllNurses(dataset.nurseProductivity.filter((r) => r.month === latest[0]?.month));

  const decisions: Decision[] = [];

  // 全社集計(4事業ライン横断)
  const aggregate = computeCompanyAggregate(latest, chLatest, cmLatest, dsLatest);
  decisions.push(buildCompanyRevenueDecision(aggregate.revenueParts, now));
  decisions.push(buildCompanyProfitDecision(aggregate.profitParts, now));

  // 訪問看護(訪問時間ベース)
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

  // 健康経営サービス(Uchi Well)(法人契約ベース)
  chLatest.forEach((m) => {
    const revenueDecision = buildCorporateHealthRevenueDecision(m, now);
    if (revenueDecision.severity !== "green") decisions.push(revenueDecision);

    const profitDecision = buildCorporateHealthProfitDecision(m, now);
    if (profitDecision.severity !== "green") decisions.push(profitDecision);

    const churnDecision = buildChurnRiskDecision(m, now);
    if (churnDecision) decisions.push(churnDecision);
  });

  // 居宅介護支援(ケース数ベース)
  cmLatest.forEach((m) => {
    const revenueDecision = buildCareManagementRevenueDecision(m, now);
    if (revenueDecision.severity !== "green") decisions.push(revenueDecision);

    const profitDecision = buildCareManagementProfitDecision(m, now);
    if (profitDecision.severity !== "green") decisions.push(profitDecision);

    const caseloadDecision = buildCaseloadDecision(m, now);
    if (caseloadDecision) decisions.push(caseloadDecision);
  });

  // 通所介護UCHINOWA(キャパシティ/稼働率ベース)
  dsLatest.forEach((m) => {
    const revenueDecision = buildDayServiceRevenueDecision(m, now);
    if (revenueDecision.severity !== "green") decisions.push(revenueDecision);

    const profitDecision = buildDayServiceProfitDecision(m, now);
    if (profitDecision.severity !== "green") decisions.push(profitDecision);

    const utilizationDecision = buildDayServiceUtilizationDecision(m, now);
    if (utilizationDecision) decisions.push(utilizationDecision);
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
