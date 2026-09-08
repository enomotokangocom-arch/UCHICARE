import { getSession } from "@/server/uchi-os/auth/session";
import { computeMonthlyKpis } from "@/server/uchi-os/kpi-engine/compute";
import { getKpiTrend } from "@/server/uchi-os/kpi-engine/trend";
import { formatYearMonth } from "@/server/uchi-os/kpi-engine/dates";
import { PageHeader } from "@/components/uchi-os/PageHeader";
import { KpiTile } from "@/components/uchi-os/KpiTile";
import { TrendChart } from "@/components/uchi-os/TrendChart";
import { formatYen, formatPercent, formatMonths } from "@/components/uchi-os/format";

export default async function FinancialDashboardPage() {
  const session = await getSession();
  if (!session) return null;

  const yearMonth = formatYearMonth(new Date());
  const [kpis, marginTrend, cashTrend] = await Promise.all([
    computeMonthlyKpis(session.organizationId, null, yearMonth),
    getKpiTrend(session.organizationId, null, ["operating_profit_margin"], 12, yearMonth),
    getKpiTrend(session.organizationId, null, ["cash_balance"], 12, yearMonth),
  ]);
  const k = new Map(kpis.map((e) => [e.kpiCode, e]));
  const get = (code: string) => k.get(code);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
      <PageHeader title="Financial Dashboard" yearMonth={yearMonth} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile label="売上" formatted={formatYen(get("revenue")?.value ?? null)} insufficientData={get("revenue")?.insufficientData} kind="FACT" />
        <KpiTile label="人件費" formatted={formatYen(get("labor_cost")?.value ?? null)} insufficientData={get("labor_cost")?.insufficientData} kind="FACT" />
        <KpiTile label="人件費率" formatted={formatPercent(get("labor_cost_ratio")?.value ?? null)} insufficientData={get("labor_cost_ratio")?.insufficientData} />
        <KpiTile label="営業利益" formatted={formatYen(get("operating_profit")?.value ?? null)} insufficientData={get("operating_profit")?.insufficientData} />
        <KpiTile label="営業利益率" formatted={formatPercent(get("operating_profit_margin")?.value ?? null)} insufficientData={get("operating_profit_margin")?.insufficientData} />
        <KpiTile label="EBITDA" formatted={formatYen(get("ebitda")?.value ?? null)} insufficientData={get("ebitda")?.insufficientData} />
        <KpiTile label="現預金" formatted={formatYen(get("cash_balance")?.value ?? null)} insufficientData={get("cash_balance")?.insufficientData} kind="FACT" />
        <KpiTile label="月次Burn Rate" formatted={formatYen(get("monthly_net_burn")?.value ?? null)} insufficientData={get("monthly_net_burn")?.insufficientData} />
        <KpiTile label="Cash Runway" formatted={formatMonths(get("cash_runway_months")?.value ?? null)} insufficientData={get("cash_runway_months")?.insufficientData} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
          <p className="mb-2 text-sm font-semibold text-neutral-700">営業利益率の推移（直近12ヶ月）</p>
          <TrendChart data={marginTrend.map((p) => ({ yearMonth: p.yearMonth, value: p.values.operating_profit_margin }))} label="営業利益率(%)" color="#16a34a" />
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
          <p className="mb-2 text-sm font-semibold text-neutral-700">現預金の推移（直近12ヶ月）</p>
          <TrendChart data={cashTrend.map((p) => ({ yearMonth: p.yearMonth, value: p.values.cash_balance }))} label="現預金" color="#0891b2" />
        </div>
      </div>
    </div>
  );
}
