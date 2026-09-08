import { computeMonthlyKpis } from "./compute";
import { lastNYearMonths } from "./dates";

export interface KpiTrendPoint {
  yearMonth: string;
  values: Record<string, number | null>;
}

/** 直近nヶ月分のKPI推移を取得する（Company/Station Dashboardのグラフ用）。 */
export async function getKpiTrend(
  organizationId: string,
  stationId: string | null,
  kpiCodes: string[],
  months: number,
  asOfYearMonth: string,
): Promise<KpiTrendPoint[]> {
  const yearMonths = lastNYearMonths(asOfYearMonth, months);
  const points: KpiTrendPoint[] = [];
  for (const yearMonth of yearMonths) {
    const kpis = await computeMonthlyKpis(organizationId, stationId, yearMonth);
    const map = new Map(kpis.map((k) => [k.kpiCode, k]));
    const values: Record<string, number | null> = {};
    for (const code of kpiCodes) {
      const entry = map.get(code);
      values[code] = entry && !entry.insufficientData ? entry.value : null;
    }
    points.push({ yearMonth, values });
  }
  return points;
}
