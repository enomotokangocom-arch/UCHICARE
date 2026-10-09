import { forecastCareManagementProfit, forecastCareManagementRevenue } from "./careManagementEngine";
import { BusinessLineTotal } from "./decisionBuilders";
import { forecastDayServiceProfit, forecastDayServiceRevenue } from "./dayServiceEngine";
import { forecastCompanyProfit, forecastCompanyRevenue } from "./forecastEngine";
import { branchUtilization } from "./productivityEngine";
import { BranchMonthlyMetric, CareManagementMonthlyMetric, DayServiceMonthlyMetric } from "./types";

function sumBy<T>(items: T[], pick: (item: T) => number): number {
  return items.reduce((acc, item) => acc + pick(item), 0);
}

export interface CompanyAggregate {
  revenueParts: BusinessLineTotal[];
  profitParts: BusinessLineTotal[];
  forecastRevenue: number;
  revenueBudget: number;
  forecastProfit: number;
  profitBudget: number;
  utilizationRates: number[];
}

/**
 * 4事業ライン(訪問看護・訪問介護Uchi Wel・居宅介護支援・通所介護UCHINOWA)を横断して
 * 売上/利益/稼働率を集計する。decisionEngine(全社Decision生成)とダッシュボードKPI表示の
 * 両方から参照され、二重計算を避ける。
 */
export function computeCompanyAggregate(
  visitBasedLatest: BranchMonthlyMetric[],
  careManagementLatest: CareManagementMonthlyMetric[],
  dayServiceLatest: DayServiceMonthlyMetric[]
): CompanyAggregate {
  const visitBasedRevenue = forecastCompanyRevenue(visitBasedLatest);
  const visitBasedProfit = forecastCompanyProfit(visitBasedLatest);
  const cmRevenueList = careManagementLatest.map(forecastCareManagementRevenue);
  const cmProfitList = careManagementLatest.map(forecastCareManagementProfit);
  const dsRevenueList = dayServiceLatest.map(forecastDayServiceRevenue);
  const dsProfitList = dayServiceLatest.map(forecastDayServiceProfit);

  const revenueParts: BusinessLineTotal[] = [
    { label: "訪問看護・訪問介護(Uchi Wel)", forecastValue: visitBasedRevenue.forecastRevenue, budget: visitBasedRevenue.revenueBudget },
    {
      label: "居宅介護支援",
      forecastValue: sumBy(cmRevenueList, (r) => r.forecastRevenue),
      budget: sumBy(cmRevenueList, (r) => r.revenueBudget),
    },
    {
      label: "通所介護(UCHINOWA)",
      forecastValue: sumBy(dsRevenueList, (r) => r.forecastRevenue),
      budget: sumBy(dsRevenueList, (r) => r.revenueBudget),
    },
  ];
  const profitParts: BusinessLineTotal[] = [
    { label: "訪問看護・訪問介護(Uchi Wel)", forecastValue: visitBasedProfit.forecastProfit, budget: visitBasedProfit.profitBudget },
    {
      label: "居宅介護支援",
      forecastValue: sumBy(cmProfitList, (r) => r.forecastProfit),
      budget: sumBy(cmProfitList, (r) => r.profitBudget),
    },
    {
      label: "通所介護(UCHINOWA)",
      forecastValue: sumBy(dsProfitList, (r) => r.forecastProfit),
      budget: sumBy(dsProfitList, (r) => r.profitBudget),
    },
  ];

  const utilizationRates = [
    ...visitBasedLatest.map((m) => branchUtilization(m).utilizationRate),
    ...dsRevenueList.map((r) => r.utilizationRate),
  ];

  return {
    revenueParts,
    profitParts,
    forecastRevenue: sumBy(revenueParts, (p) => p.forecastValue),
    revenueBudget: sumBy(revenueParts, (p) => p.budget),
    forecastProfit: sumBy(profitParts, (p) => p.forecastValue),
    profitBudget: sumBy(profitParts, (p) => p.budget),
    utilizationRates,
  };
}
