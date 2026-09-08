import { getSession } from "@/server/uchi-os/auth/session";
import { prisma } from "@/server/uchi-os/db/client";
import { formatYearMonth } from "@/server/uchi-os/kpi-engine/dates";
import { PageHeader } from "@/components/uchi-os/PageHeader";
import { DEFAULT_THRESHOLDS } from "@/server/uchi-os/decision-engine/rules";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) return null;

  const [organization, stations, users] = await Promise.all([
    prisma.organization.findUnique({ where: { id: session.organizationId } }),
    prisma.station.findMany({ where: { organizationId: session.organizationId }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { organizationId: session.organizationId }, orderBy: { createdAt: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-10">
      <PageHeader title="Settings" yearMonth={formatYearMonth(new Date())} />

      <section className="rounded-2xl border border-neutral-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-neutral-700">組織情報</h2>
        <p className="mt-2 text-sm text-neutral-900">{organization?.name}</p>
        <p className="text-xs text-neutral-500">プラン: {organization?.planTier} / タイムゾーン: {organization?.timezone}</p>
      </section>

      <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-neutral-700">拠点一覧</h2>
        <ul className="mt-2 divide-y divide-neutral-100">
          {stations.map((s) => (
            <li key={s.id} className="flex items-center justify-between py-2 text-sm">
              <span className="font-medium text-neutral-900">{s.name}</span>
              <span className="text-xs text-neutral-500">{s.status}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-neutral-700">ユーザー一覧</h2>
        <ul className="mt-2 divide-y divide-neutral-100">
          {users.map((u) => (
            <li key={u.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <p className="font-medium text-neutral-900">{u.name}</p>
                <p className="text-xs text-neutral-500">{u.email}</p>
              </div>
              <span className="text-xs text-neutral-500">{u.role}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-neutral-700">Decision Rule 閾値（既定値）</h2>
        <p className="mt-1 text-xs text-neutral-400">
          Phase1では拠点別の閾値編集UIは未実装です（07章冒頭の方針どおり、内部的には組織/拠点別に上書き可能な
          設計になっています。編集UIはPhase2で追加予定）。
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
          <div>
            <dt className="text-xs text-neutral-500">売上低下 WARNING</dt>
            <dd className="font-medium">{DEFAULT_THRESHOLDS.revenueDropWarnPct}%</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">売上低下 CRITICAL</dt>
            <dd className="font-medium">{DEFAULT_THRESHOLDS.revenueDropCriticalPct}%</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">稼働率 WARNING</dt>
            <dd className="font-medium">{DEFAULT_THRESHOLDS.utilizationWarnPct}%未満</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">稼働率 CRITICAL</dt>
            <dd className="font-medium">{DEFAULT_THRESHOLDS.utilizationCriticalPct}%未満</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Cash Runway WARNING</dt>
            <dd className="font-medium">{DEFAULT_THRESHOLDS.cashRunwayWarnMonths}ヶ月未満</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Cash Runway CRITICAL</dt>
            <dd className="font-medium">{DEFAULT_THRESHOLDS.cashRunwayCriticalMonths}ヶ月未満</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
