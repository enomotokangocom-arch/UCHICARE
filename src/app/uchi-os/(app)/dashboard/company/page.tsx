import Link from "next/link";
import { getSession } from "@/server/uchi-os/auth/session";
import { prisma } from "@/server/uchi-os/db/client";
import { computeMonthlyKpis } from "@/server/uchi-os/kpi-engine/compute";
import { getKpiTrend } from "@/server/uchi-os/kpi-engine/trend";
import { formatYearMonth } from "@/server/uchi-os/kpi-engine/dates";
import { computeStationForecast, computeCashRunwayForecast } from "@/server/uchi-os/forecast-engine/forecast";
import { PageHeader } from "@/components/uchi-os/PageHeader";
import { KpiTile } from "@/components/uchi-os/KpiTile";
import { TrendChart } from "@/components/uchi-os/TrendChart";
import { ForecastTile } from "@/components/uchi-os/ForecastTile";
import { formatYen, formatPercent, formatNumber, formatMonths } from "@/components/uchi-os/format";

function kpiMap(entries: Awaited<ReturnType<typeof computeMonthlyKpis>>) {
  return new Map(entries.map((e) => [e.kpiCode, e]));
}

export default async function CompanyDashboardPage() {
  const session = await getSession();
  if (!session) return null;

  const yearMonth = formatYearMonth(new Date());
  const stations = await prisma.station.findMany({
    where: { organizationId: session.organizationId, status: "ACTIVE" },
    orderBy: { name: "asc" },
  });

  const [companyKpis, stationKpisList, revenueTrend, revenueForecast, cashForecast] = await Promise.all([
    computeMonthlyKpis(session.organizationId, null, yearMonth),
    Promise.all(stations.map((s) => computeMonthlyKpis(session.organizationId, s.id, yearMonth))),
    getKpiTrend(session.organizationId, null, ["monthly_revenue"], 12, yearMonth),
    computeStationForecast(session.organizationId, null, yearMonth),
    computeCashRunwayForecast(session.organizationId, yearMonth),
  ]);

  const company = kpiMap(companyKpis);
  const get = (code: string) => company.get(code);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
      <PageHeader title="Company Dashboard" yearMonth={yearMonth} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile label="月間売上" formatted={formatYen(get("monthly_revenue")?.value ?? null)} insufficientData={get("monthly_revenue")?.insufficientData} kind="FACT" />
        <KpiTile label="前月比" formatted={formatPercent(get("revenue_mom")?.value ?? null)} insufficientData={get("revenue_mom")?.insufficientData} />
        <KpiTile label="前年同月比" formatted={formatPercent(get("revenue_yoy")?.value ?? null)} insufficientData={get("revenue_yoy")?.insufficientData} />
        <KpiTile label="利用者数" formatted={formatNumber(get("patient_count")?.value ?? null)} insufficientData={get("patient_count")?.insufficientData} kind="FACT" />
        <KpiTile label="利用者純増" formatted={formatNumber(get("net_patient_change")?.value ?? null)} insufficientData={get("net_patient_change")?.insufficientData} />
        <KpiTile label="営業利益率" formatted={formatPercent(get("operating_profit_margin")?.value ?? null)} insufficientData={get("operating_profit_margin")?.insufficientData} />
        <KpiTile label="人件費率" formatted={formatPercent(get("labor_cost_ratio")?.value ?? null)} insufficientData={get("labor_cost_ratio")?.insufficientData} />
        <KpiTile label="Cash Runway" formatted={formatNumber(get("cash_runway_months")?.value ?? null, 1) + (Number.isFinite(get("cash_runway_months")?.value ?? 0) ? "ヶ月" : "")} insufficientData={get("cash_runway_months")?.insufficientData} />
      </div>

      <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5">
        <p className="mb-2 text-sm font-semibold text-neutral-700">月間売上の推移（直近12ヶ月）</p>
        <TrendChart data={revenueTrend.map((p) => ({ yearMonth: p.yearMonth, value: p.values.monthly_revenue }))} label="売上" />
      </div>

      <div className="mt-6">
        <p className="mb-2 text-sm font-semibold text-neutral-700">予測（Forecast Engine、線形回帰による決定論的計算）</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <ForecastTile label="売上予測" horizonLabel="翌月" forecast={revenueForecast.revenue.nextMonth} />
          <ForecastTile label="売上予測" horizonLabel="3ヶ月後" forecast={revenueForecast.revenue.threeMonths} />
          <ForecastTile label="営業利益予測" horizonLabel="翌月" forecast={revenueForecast.operatingProfit.nextMonth} />
          <ForecastTile label="営業利益予測" horizonLabel="3ヶ月後" forecast={revenueForecast.operatingProfit.threeMonths} />
        </div>
        <div className="mt-3 rounded-xl border border-neutral-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-neutral-500">Cash Runway予測（3ヶ月後時点）</p>
          </div>
          <p className="mt-1.5 text-2xl font-semibold tracking-tight text-neutral-900">
            {formatMonths(cashForecast.projectedRunwayMonthsFromThen)}
          </p>
          <p className="mt-0.5 text-xs text-neutral-400">
            前提: 直近3ヶ月平均Burn {formatYen(cashForecast.averageMonthlyBurn)}/月 が継続した場合
          </p>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
        <p className="border-b border-neutral-200 px-5 py-3 text-sm font-semibold text-neutral-700">拠点別比較</p>
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
              <th className="px-5 py-2 font-medium">拠点</th>
              <th className="px-3 py-2 font-medium">売上</th>
              <th className="px-3 py-2 font-medium">前月比</th>
              <th className="px-3 py-2 font-medium">利用者数</th>
              <th className="px-3 py-2 font-medium">稼働率</th>
              <th className="px-3 py-2 font-medium">拠点営業利益</th>
            </tr>
          </thead>
          <tbody>
            {stations.map((station, i) => {
              const k = kpiMap(stationKpisList[i]);
              return (
                <tr key={station.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-5 py-2.5 font-medium text-neutral-900">
                    <Link href={`/uchi-os/dashboard/station/${station.id}`} className="hover:underline">
                      {station.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">{formatYen(k.get("monthly_revenue")?.value ?? null)}</td>
                  <td className="px-3 py-2.5">{formatPercent(k.get("revenue_mom")?.value ?? null)}</td>
                  <td className="px-3 py-2.5">{formatNumber(k.get("patient_count")?.value ?? null)}</td>
                  <td className="px-3 py-2.5">{formatPercent(k.get("utilization_rate")?.value ?? null)}</td>
                  <td className="px-3 py-2.5">{formatYen(k.get("station_operating_profit")?.value ?? null)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
