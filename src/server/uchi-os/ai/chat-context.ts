import { prisma } from "@/server/uchi-os/db/client";
import { computeMonthlyKpis } from "@/server/uchi-os/kpi-engine/compute";
import { computeHealthScore } from "@/server/uchi-os/health-score/compute";
import { computeStationForecast } from "@/server/uchi-os/forecast-engine/forecast";
import type { ChatContext, ChatContextStation } from "./prompts";

/** チャット回答の根拠として渡す、会社全体・拠点別・Decision一覧のスナップショットを組み立てる。 */
export async function buildChatContext(organizationId: string, yearMonth: string): Promise<ChatContext> {
  const stations = await prisma.station.findMany({
    where: { organizationId, status: "ACTIVE" },
    select: { id: true, name: true },
  });

  const [companyKpiEntries, healthScore, decisions] = await Promise.all([
    computeMonthlyKpis(organizationId, null, yearMonth),
    computeHealthScore(organizationId, yearMonth),
    prisma.decision.findMany({
      where: { organizationId, status: { in: ["AI_RECOMMENDED", "HUMAN_REVIEWED"] }, alert: { status: { in: ["OPEN", "ACKNOWLEDGED"] } } },
      include: { station: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
  ]);
  const companyKpis = new Map(companyKpiEntries.map((e) => [e.kpiCode, e]));
  const get = (code: string) => {
    const entry = companyKpis.get(code);
    return entry && !entry.insufficientData ? entry.value : null;
  };

  const stationRows: ChatContextStation[] = await Promise.all(
    stations.map(async (station) => {
      const entries = await computeMonthlyKpis(organizationId, station.id, yearMonth);
      const map = new Map(entries.map((e) => [e.kpiCode, e]));
      const value = (code: string) => {
        const entry = map.get(code);
        return entry && !entry.insufficientData ? entry.value : null;
      };
      return {
        name: station.name,
        revenue: value("monthly_revenue"),
        revenueMoM: value("revenue_mom"),
        utilizationRate: value("utilization_rate"),
        operatingProfit: value("station_operating_profit"),
      };
    }),
  );

  let forecastNote = "予測データはありません。";
  const companyForecast = await computeStationForecast(organizationId, null, yearMonth).catch(() => null);
  if (companyForecast?.revenue.nextMonth) {
    forecastNote = `法人全体の翌月売上予測(線形回帰、AI ESTIMATE): ${Math.round(
      companyForecast.revenue.nextMonth.value,
    ).toLocaleString("ja-JP")}円(予測区間 ${Math.round(companyForecast.revenue.nextMonth.low).toLocaleString(
      "ja-JP",
    )}〜${Math.round(companyForecast.revenue.nextMonth.high).toLocaleString("ja-JP")}円)。具体的なwhat-if試算はScenario Simulatorで行ってください。`;
  }

  return {
    yearMonth,
    healthScore: healthScore.overall,
    companyRevenue: get("revenue"),
    companyRevenueMoM: get("revenue_mom"),
    companyOperatingProfitMargin: get("operating_profit_margin"),
    cashRunwayMonths: get("cash_runway_months"),
    stations: stationRows,
    activeDecisions: decisions.map((d) => ({
      stationName: d.station?.name ?? "法人全体",
      priority: d.priority,
      problemSummary: d.problemSummary,
      ruleCode: d.ruleCode,
    })),
    forecastNote,
  };
}
