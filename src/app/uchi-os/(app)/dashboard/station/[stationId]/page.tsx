import { notFound } from "next/navigation";
import { getSession } from "@/server/uchi-os/auth/session";
import { prisma } from "@/server/uchi-os/db/client";
import { computeMonthlyKpis } from "@/server/uchi-os/kpi-engine/compute";
import { getKpiTrend } from "@/server/uchi-os/kpi-engine/trend";
import { formatYearMonth } from "@/server/uchi-os/kpi-engine/dates";
import { computeStationForecast } from "@/server/uchi-os/forecast-engine/forecast";
import { PageHeader } from "@/components/uchi-os/PageHeader";
import { KpiTile } from "@/components/uchi-os/KpiTile";
import { TrendChart } from "@/components/uchi-os/TrendChart";
import { ForecastTile } from "@/components/uchi-os/ForecastTile";
import { DataSourceBadge } from "@/components/uchi-os/DataSourceBadge";
import { formatYen, formatPercent, formatNumber } from "@/components/uchi-os/format";

export default async function StationDashboardPage({ params }: { params: Promise<{ stationId: string }> }) {
  const session = await getSession();
  if (!session) return null;
  const { stationId } = await params;

  const station = await prisma.station.findFirst({ where: { id: stationId, organizationId: session.organizationId } });
  if (!station) notFound();

  const yearMonth = formatYearMonth(new Date());
  const [kpis, utilizationTrend, forecast] = await Promise.all([
    computeMonthlyKpis(session.organizationId, stationId, yearMonth),
    getKpiTrend(session.organizationId, stationId, ["utilization_rate"], 12, yearMonth),
    computeStationForecast(session.organizationId, stationId, yearMonth),
  ]);
  const k = new Map(kpis.map((e) => [e.kpiCode, e]));
  const get = (code: string) => k.get(code);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
      <PageHeader title={`Station Dashboard — ${station.name}`} yearMonth={yearMonth} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile label="月間売上" formatted={formatYen(get("monthly_revenue")?.value ?? null)} insufficientData={get("monthly_revenue")?.insufficientData} kind="FACT" />
        <KpiTile label="前月比" formatted={formatPercent(get("revenue_mom")?.value ?? null)} insufficientData={get("revenue_mom")?.insufficientData} />
        <KpiTile label="利用者数" formatted={formatNumber(get("patient_count")?.value ?? null)} insufficientData={get("patient_count")?.insufficientData} kind="FACT" />
        <KpiTile label="利用者純増" formatted={formatNumber(get("net_patient_change")?.value ?? null)} insufficientData={get("net_patient_change")?.insufficientData} />
        <KpiTile label="新規利用者" formatted={formatNumber(get("new_patients")?.value ?? null)} insufficientData={get("new_patients")?.insufficientData} kind="FACT" />
        <KpiTile label="終了利用者" formatted={formatNumber(get("ended_patients")?.value ?? null)} insufficientData={get("ended_patients")?.insufficientData} kind="FACT" />
        <KpiTile label="稼働率" formatted={formatPercent(get("utilization_rate")?.value ?? null)} insufficientData={get("utilization_rate")?.insufficientData} />
        <KpiTile label="拠点営業利益" formatted={formatYen(get("station_operating_profit")?.value ?? null)} insufficientData={get("station_operating_profit")?.insufficientData} />
        <KpiTile label="看護師数" formatted={formatNumber(get("nurse_count")?.value ?? null)} insufficientData={get("nurse_count")?.insufficientData} kind="FACT" />
        <KpiTile label="総訪問件数" formatted={formatNumber(get("total_visits")?.value ?? null)} insufficientData={get("total_visits")?.insufficientData} kind="FACT" />
        <KpiTile label="看護師1人当たり訪問時間" formatted={formatNumber(get("visit_minutes_per_nurse")?.value ?? null) + "分"} insufficientData={get("visit_minutes_per_nurse")?.insufficientData} />
        <KpiTile label="看護師1人当たり売上" formatted={formatYen(get("revenue_per_nurse")?.value ?? null)} insufficientData={get("revenue_per_nurse")?.insufficientData} />
      </div>

      <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5">
        <p className="mb-2 text-sm font-semibold text-neutral-700">稼働率の推移（直近12ヶ月）</p>
        <TrendChart data={utilizationTrend.map((p) => ({ yearMonth: p.yearMonth, value: p.values.utilization_rate }))} label="稼働率(%)" color="#2563eb" />
      </div>

      <div className="mt-6">
        <p className="mb-2 text-sm font-semibold text-neutral-700">予測（Forecast Engine、線形回帰による決定論的計算）</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <ForecastTile label="売上予測" horizonLabel="翌月" forecast={forecast.revenue.nextMonth} />
          <ForecastTile label="売上予測" horizonLabel="3ヶ月後" forecast={forecast.revenue.threeMonths} />
          <ForecastTile label="利用者数予測" horizonLabel="翌月" forecast={forecast.patientCount.nextMonth} kind="number" />
          <ForecastTile label="利用者数予測" horizonLabel="3ヶ月後" forecast={forecast.patientCount.threeMonths} kind="number" />
        </div>
        <div className="mt-3 rounded-xl border border-neutral-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-neutral-500">必要看護師数予測</p>
            <DataSourceBadge kind="AI_ESTIMATE" />
          </div>
          <p className="mt-1.5 text-sm text-neutral-700">
            現員 <span className="font-semibold">{forecast.requiredNurses.currentNurses ?? "—"}名</span> ／
            翌月必要数 <span className="font-semibold">{forecast.requiredNurses.nextMonth ?? "—"}名</span> ／
            3ヶ月後必要数 <span className="font-semibold">{forecast.requiredNurses.threeMonths ?? "—"}名</span>
          </p>
        </div>
      </div>
    </div>
  );
}
