import { getSession } from "@/server/uchi-os/auth/session";
import { prisma } from "@/server/uchi-os/db/client";
import { formatYearMonth } from "@/server/uchi-os/kpi-engine/dates";
import { PageHeader } from "@/components/uchi-os/PageHeader";
import { ThresholdEditor } from "@/components/uchi-os/settings/ThresholdEditor";
import { NotificationSettings } from "@/components/uchi-os/settings/NotificationSettings";
import { computeAllRulePerformance } from "@/server/uchi-os/feedback-loop/rule-performance";
import { RULE_LABELS } from "@/server/uchi-os/decision-engine/rule-labels";
import { MIN_SAMPLE_SIZE_FOR_PRIOR } from "@/server/uchi-os/decision-engine/generate";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) return null;

  const [organization, stations, users, rulePerformance] = await Promise.all([
    prisma.organization.findUnique({ where: { id: session.organizationId } }),
    prisma.station.findMany({ where: { organizationId: session.organizationId }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { organizationId: session.organizationId }, orderBy: { createdAt: "asc" } }),
    computeAllRulePerformance(session.organizationId),
  ]);
  const rulePerformanceRows = Object.values(rulePerformance).sort((a, b) => a.ruleCode.localeCompare(b.ruleCode));

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
        <h2 className="text-sm font-semibold text-neutral-700">ルール別成果(Feedback Loop)</h2>
        <p className="mt-1 text-xs text-neutral-400">
          23章 Feedback Loop: 実績確認済み(Result Verified)のActionについて、期待効果(Expected Impact)を実績(Actual
          Impact)が達成できた割合です。{MIN_SAMPLE_SIZE_FOR_PRIOR}件以上のサンプルがあるルールはConfidence計算のhistoricalPriorに反映されます。
        </p>
        {rulePerformanceRows.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-400">まだ実績データがありません。ActionをResult Verifiedにすると集計されます。</p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-100">
            {rulePerformanceRows.map((p) => (
              <li key={p.ruleCode} className="flex items-center justify-between py-2 text-sm">
                <span className="font-medium text-neutral-900">
                  {p.ruleCode} {RULE_LABELS[p.ruleCode] ?? ""}
                </span>
                <span className="text-xs text-neutral-500">
                  成功率 {p.successRate != null ? `${Math.round(p.successRate * 100)}%` : "-"}(n={p.sampleSize})
                  {p.sampleSize < MIN_SAMPLE_SIZE_FOR_PRIOR ? " ・サンプル不足" : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-neutral-700">通知設定</h2>
        <p className="mt-1 text-xs text-neutral-400">
          23章 Feedback Loop / 通知・自動化: CRITICAL Alert発生時のSlack通知、日次レポートの自動送信を設定します。
        </p>
        <div className="mt-3">
          <NotificationSettings />
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-neutral-700">Decision Rule 閾値</h2>
        <p className="mt-1 text-xs text-neutral-400">
          07章冒頭の方針どおり、組織全体の既定値・拠点別の上書きのどちらも編集できます(拠点別が優先されます)。
        </p>
        <div className="mt-3">
          <ThresholdEditor stations={stations.map((s) => ({ id: s.id, name: s.name }))} />
        </div>
      </section>
    </div>
  );
}
