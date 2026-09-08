import { getSession } from "@/server/uchi-os/auth/session";
import { prisma } from "@/server/uchi-os/db/client";
import { computeMonthlyKpis } from "@/server/uchi-os/kpi-engine/compute";
import { formatYearMonth, monthRange } from "@/server/uchi-os/kpi-engine/dates";
import { PageHeader } from "@/components/uchi-os/PageHeader";
import { KpiTile } from "@/components/uchi-os/KpiTile";
import { formatNumber, formatPercent } from "@/components/uchi-os/format";

export default async function SalesDashboardPage() {
  const session = await getSession();
  if (!session) return null;

  const yearMonth = formatYearMonth(new Date());
  const kpis = await computeMonthlyKpis(session.organizationId, null, yearMonth);
  const k = new Map(kpis.map((e) => [e.kpiCode, e]));
  const get = (code: string) => k.get(code);

  const { start } = monthRange(yearMonth);
  const referralSources = await prisma.referralSource.findMany({
    where: { organizationId: session.organizationId },
    include: {
      salesActivities: {
        orderBy: { occurredAt: "desc" },
        take: 1,
      },
    },
    take: 20,
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
      <PageHeader title="Sales Dashboard" yearMonth={yearMonth} />
      <p className="mb-4 text-xs text-neutral-400">
        Phase1簡易版: 営業KPIのみ表示（紹介元別売上・営業ROIはPhase2以降で拡張予定）
      </p>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile label="営業件数" formatted={formatNumber(get("sales_activity_count")?.value ?? null)} insufficientData={get("sales_activity_count")?.insufficientData} kind="FACT" />
        <KpiTile label="営業先数" formatted={formatNumber(get("active_referral_sources")?.value ?? null)} insufficientData={get("active_referral_sources")?.insufficientData} kind="FACT" />
        <KpiTile label="紹介件数" formatted={formatNumber(get("referral_count")?.value ?? null)} insufficientData={get("referral_count")?.insufficientData} kind="FACT" />
        <KpiTile label="紹介率" formatted={formatPercent(get("referral_rate")?.value ?? null)} insufficientData={get("referral_rate")?.insufficientData} />
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
        <p className="border-b border-neutral-200 px-5 py-3 text-sm font-semibold text-neutral-700">紹介元一覧・最終訪問日</p>
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
              <th className="px-5 py-2 font-medium">紹介元</th>
              <th className="px-3 py-2 font-medium">種別</th>
              <th className="px-3 py-2 font-medium">最終接触日</th>
              <th className="px-3 py-2 font-medium">状態</th>
            </tr>
          </thead>
          <tbody>
            {referralSources.map((source) => {
              const lastVisit = source.salesActivities[0]?.occurredAt ?? null;
              const dormant = !lastVisit || lastVisit < new Date(start.getTime() - 90 * 24 * 60 * 60 * 1000);
              return (
                <tr key={source.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-5 py-2.5 font-medium text-neutral-900">{source.name}</td>
                  <td className="px-3 py-2.5 text-neutral-500">{source.type ?? "—"}</td>
                  <td className="px-3 py-2.5">{lastVisit ? lastVisit.toLocaleDateString("ja-JP") : "記録なし"}</td>
                  <td className="px-3 py-2.5">
                    {dormant ? (
                      <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700">休眠傾向</span>
                    ) : (
                      <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-700">継続中</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
