import { getSession } from "@/server/uchi-os/auth/session";
import { prisma } from "@/server/uchi-os/db/client";
import { computeMonthlyKpis } from "@/server/uchi-os/kpi-engine/compute";
import { formatYearMonth } from "@/server/uchi-os/kpi-engine/dates";
import { PageHeader } from "@/components/uchi-os/PageHeader";
import { KpiTile } from "@/components/uchi-os/KpiTile";
import { formatNumber, formatPercent } from "@/components/uchi-os/format";

function kpiMap(entries: Awaited<ReturnType<typeof computeMonthlyKpis>>) {
  return new Map(entries.map((e) => [e.kpiCode, e]));
}

export default async function WorkforceDashboardPage() {
  const session = await getSession();
  if (!session) return null;

  const yearMonth = formatYearMonth(new Date());
  const stations = await prisma.station.findMany({
    where: { organizationId: session.organizationId, status: "ACTIVE" },
    orderBy: { name: "asc" },
  });

  const [companyKpis, stationKpisList] = await Promise.all([
    computeMonthlyKpis(session.organizationId, null, yearMonth),
    Promise.all(stations.map((s) => computeMonthlyKpis(session.organizationId, s.id, yearMonth))),
  ]);
  const company = kpiMap(companyKpis);
  const get = (code: string) => company.get(code);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
      <PageHeader title="Workforce Dashboard" yearMonth={yearMonth} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile label="看護師数" formatted={formatNumber(get("nurse_count")?.value ?? null)} insufficientData={get("nurse_count")?.insufficientData} kind="FACT" />
        <KpiTile label="リハ職数" formatted={formatNumber(get("therapist_count")?.value ?? null)} insufficientData={get("therapist_count")?.insufficientData} kind="FACT" />
        <KpiTile label="事務職数" formatted={formatNumber(get("office_staff_count")?.value ?? null)} insufficientData={get("office_staff_count")?.insufficientData} kind="FACT" />
        <KpiTile label="FTE合計" formatted={formatNumber(get("total_fte")?.value ?? null, 1)} insufficientData={get("total_fte")?.insufficientData} />
        <KpiTile label="採用数（当月）" formatted={formatNumber(get("hires_count")?.value ?? null)} insufficientData={get("hires_count")?.insufficientData} kind="FACT" />
        <KpiTile label="退職数（当月）" formatted={formatNumber(get("resignations_count")?.value ?? null)} insufficientData={get("resignations_count")?.insufficientData} kind="FACT" />
        <KpiTile label="離職率" formatted={formatPercent(get("turnover_rate")?.value ?? null)} insufficientData={get("turnover_rate")?.insufficientData} />
        <KpiTile label="全社稼働率" formatted={formatPercent(get("utilization_rate")?.value ?? null)} insufficientData={get("utilization_rate")?.insufficientData} />
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
        <p className="border-b border-neutral-200 px-5 py-3 text-sm font-semibold text-neutral-700">拠点別 稼働状況</p>
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
              <th className="px-5 py-2 font-medium">拠点</th>
              <th className="px-3 py-2 font-medium">看護師数</th>
              <th className="px-3 py-2 font-medium">FTE合計</th>
              <th className="px-3 py-2 font-medium">稼働率</th>
              <th className="px-3 py-2 font-medium">離職率</th>
            </tr>
          </thead>
          <tbody>
            {stations.map((station, i) => {
              const k = kpiMap(stationKpisList[i]);
              return (
                <tr key={station.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-5 py-2.5 font-medium text-neutral-900">{station.name}</td>
                  <td className="px-3 py-2.5">{formatNumber(k.get("nurse_count")?.value ?? null)}</td>
                  <td className="px-3 py-2.5">{formatNumber(k.get("total_fte")?.value ?? null, 1)}</td>
                  <td className="px-3 py-2.5">{formatPercent(k.get("utilization_rate")?.value ?? null)}</td>
                  <td className="px-3 py-2.5">{formatPercent(k.get("turnover_rate")?.value ?? null)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
