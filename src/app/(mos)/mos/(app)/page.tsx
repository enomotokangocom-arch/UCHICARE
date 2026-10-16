import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/mos/server/auth";
import { getDb } from "@/mos/server/db";
import { dataFreshness, hasOrigin, listSnapshots, originFromParam, reviewStats } from "@/mos/server/queries";
import { viewPLForRole } from "@/mos/domain/view";
import { JOB_TYPE_LABEL, UNIT_LABEL, type BusinessUnit } from "@/mos/domain/types";
import { METRIC_KEYS } from "@/mos/domain/parsers/mapped";
import { SampleBanner, StatusBadge } from "@/mos/ui/Badges";
import { Card, Notice, PageHeader } from "@/mos/ui/Card";
import { MonthPicker } from "@/mos/ui/MonthPicker";
import { ProfitTrendChart, RevenueTrendChart, SERIES_COLOR, type TrendPoint } from "@/mos/ui/Charts";
import { BarList } from "@/mos/ui/BarList";
import { dateTime, man, num, pct, yen, ymLabel } from "@/mos/ui/format";

export const metadata: Metadata = { title: "経営ダッシュボード" };

const TARGET_LABEL = { REVENUE: "売上", OPERATING_PROFIT: "営業利益", VISITS: "訪問件数" } as const;

function Tile({ label, value, sub, badge }: { label: string; value: string; sub?: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-slate-600">{label}</p>
        {badge}
      </div>
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
      {sub && <div className="mt-1 text-xs text-slate-600">{sub}</div>}
    </div>
  );
}

export default async function DashboardPage(props: PageProps<"/mos">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const origin = originFromParam(sp.data);
  const db = getDb();
  const snapshots = await listSnapshots(db, origin);
  const freshness = await dataFreshness(db, origin);
  const sampleAvailable = origin === "REAL" && (await hasOrigin(db, "SAMPLE"));
  const denied = sp.denied === "1";

  if (snapshots.length === 0) {
    return (
      <>
        <PageHeader title="経営ダッシュボード" />
        <SampleBanner origin={origin} />
        {denied && <Notice tone="warn">この画面を表示する権限がありません。</Notice>}
        <Card>
          <p className="text-sm text-slate-700">まだ{origin === "SAMPLE" ? "サンプル" : "実"}データがありません。</p>
          {user.role !== "STAFF" && (
            <p className="mt-2 text-sm">
              <Link href="/mos/imports" className="text-teal-700 underline">
                ファイル取込
              </Link>
              から、試算表・居宅売上管理表・銀行明細などを取込んでください。
            </p>
          )}
          {sampleAvailable && (
            <p className="mt-2 text-sm">
              <Link href="?data=sample" className="text-violet-700 underline">
                サンプルデータで画面を確認する
              </Link>
            </p>
          )}
        </Card>
      </>
    );
  }

  const months = snapshots.map((s) => s.yearMonth);
  const ymParam = typeof sp.ym === "string" ? sp.ym : undefined;
  const withData = snapshots.filter((s) => s.data.pl.basis !== "NONE");
  const selected = snapshots.find((s) => s.yearMonth === ymParam) ?? withData[withData.length - 1] ?? snapshots[snapshots.length - 1];
  const pl = viewPLForRole(selected.data.pl, user.role);
  const kpi = selected.data.kpi;
  const review = await reviewStats(db, origin, selected.yearMonth);

  const idx = snapshots.indexOf(selected);
  const trend: TrendPoint[] = snapshots.slice(Math.max(0, idx - 11), idx + 1).map((s) => ({
    label: `${Number(s.yearMonth.slice(5))}月`,
    HOMONKANGO: s.data.pl.units.HOMONKANGO.revenue,
    KYOTAKU: s.data.pl.units.KYOTAKU.revenue,
    companyRevenue: s.data.pl.company.revenue,
    operatingProfit: s.data.pl.company.operatingProfit,
    status: { ESTIMATED: "推計", RECONCILED: "照合済", FINAL: "確定" }[s.data.pl.status],
  }));

  const expenses = [...pl.company.expenses].sort((a, b) => b.amount - a.amount);
  const topExpenses = expenses.slice(0, 8);
  const otherExpense = expenses.slice(8).reduce((s, e) => s + e.amount, 0);
  const basisLabel = { TRIAL_BALANCE: "試算表ベース", ESTIMATE: "業務データ・銀行明細による推計", NONE: "データなし" }[pl.basis];

  return (
    <>
      <PageHeader title="経営ダッシュボード" description={`${ymLabel(selected.yearMonth)}・${basisLabel}`}>
        <div className="flex flex-wrap items-center gap-3">
          <MonthPicker months={months} value={selected.yearMonth} />
          {(sampleAvailable || origin === "SAMPLE") && (
            <Link href={origin === "SAMPLE" ? "?" : "?data=sample"} className="text-xs text-violet-700 underline">
              {origin === "SAMPLE" ? "実データを表示" : "サンプルデータを表示"}
            </Link>
          )}
        </div>
      </PageHeader>
      <SampleBanner origin={origin} />
      {denied && (
        <div className="mb-4">
          <Notice tone="warn">その画面を表示する権限がありません。</Notice>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-600">
        <span>最終データ取込: {dateTime(freshness.lastImportAt)}</span>
        <span>最終再計算: {dateTime(freshness.lastRecalcAt)}（毎朝8時に自動再計算）</span>
        {freshness.lastRecalcFailedAt && <span className="font-semibold text-red-700">再計算に失敗しました（{dateTime(freshness.lastRecalcFailedAt)}）</span>}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="全社売上" value={man(pl.company.revenue)} badge={<StatusBadge status={pl.status} />} sub={yen(pl.company.revenue)} />
        <Tile label="全社営業利益" value={man(pl.company.operatingProfit)} sub={yen(pl.company.operatingProfit)} />
        <Tile label="営業利益率" value={pct(pl.company.operatingMargin)} />
        <Tile label="人件費率" value={pct(pl.company.laborRatio)} sub="人件費 ÷ 売上" />
      </div>

      {pl.notes.length > 0 && (
        <div className="mt-3 space-y-1">
          {pl.notes.map((n) => (
            <Notice key={n} tone="info">
              {n}
            </Notice>
          ))}
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="事業所別 売上・営業利益">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="py-1 text-left">事業所</th>
                  <th className="text-right">売上</th>
                  <th className="text-right">営業利益</th>
                  <th className="text-right">利益率</th>
                  <th className="text-right">状態</th>
                </tr>
              </thead>
              <tbody>
                {(["HOMONKANGO", "KYOTAKU"] as BusinessUnit[]).map((u) => (
                  <tr key={u} className="border-t border-slate-100">
                    <td className="py-2">
                      <span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: SERIES_COLOR[u] }} />
                      {UNIT_LABEL[u]}
                    </td>
                    <td className="text-right tabular-nums">{yen(pl.units[u].revenue)}</td>
                    <td className="text-right tabular-nums">{yen(pl.units[u].operatingProfit)}</td>
                    <td className="text-right tabular-nums">{pct(pl.units[u].operatingMargin)}</td>
                    <td className="text-right">
                      <StatusBadge status={pl.units[u].revenueStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-500">営業利益は共通費・本部費を配賦した後の金額です。</p>
        </Card>

        <Card title="月次目標の達成率">
          {kpi.targets.length === 0 ? (
            <p className="text-sm text-slate-600">この月の目標は未設定です。</p>
          ) : (
            <BarList
              items={kpi.targets.map((t) => ({
                label: `${UNIT_LABEL[t.unit]}・${TARGET_LABEL[t.metric]}`,
                value: t.rate,
                note: `目標 ${t.metric === "VISITS" ? `${num(t.target)}件` : man(t.target)}`,
              }))}
              format={(v) => pct(v)}
              max={1}
            />
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="訪問・利用者">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-slate-500">訪問件数（iBow実施実績）</dt>
              <dd className="text-lg font-semibold tabular-nums">{kpi.visits.actual === null ? "データなし" : `${num(kpi.visits.actual)}件`}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">訪問予定（ZEST）</dt>
              <dd className="text-lg font-semibold tabular-nums">
                {kpi.visits.scheduled === null
                  ? kpi.zestMetrics.VISITS_PLANNED !== undefined
                    ? `${num(kpi.zestMetrics.VISITS_PLANNED)}件`
                    : "データなし"
                  : `${num(kpi.visits.scheduled)}件`}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">キャンセル件数</dt>
              <dd className="tabular-nums">
                実績側 {kpi.visits.cancelledActualSource === null ? "—" : `${num(kpi.visits.cancelledActualSource)}件`} ／ 予定側{" "}
                {kpi.visits.cancelledScheduleSource === null ? (kpi.zestMetrics.VISITS_CANCELLED !== undefined ? `${num(kpi.zestMetrics.VISITS_CANCELLED)}件` : "—") : `${num(kpi.visits.cancelledScheduleSource)}件`}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">利用者数</dt>
              <dd className="tabular-nums">
                訪問看護 {kpi.users.homonkango === null ? "—" : `${num(kpi.users.homonkango)}人`}
                <br />
                居宅支援 {kpi.users.kyotaku === null ? "—" : `${num(kpi.users.kyotaku)}人`}
                <span className="block text-[11px] text-slate-500">居宅は今月請求件数（要介護＋要支援）</span>
              </dd>
            </div>
          </dl>
          {Object.keys(kpi.zestMetrics).length > 0 && (
            <ul className="mt-3 border-t border-slate-100 pt-2 text-xs text-slate-600">
              {Object.entries(kpi.zestMetrics).map(([k, v]) => (
                <li key={k}>
                  ZEST {METRIC_KEYS.find((m) => m.key === k)?.label ?? k}: {num(v)}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="職種別稼働率">
          {kpi.utilization.length === 0 ? (
            <p className="text-sm text-slate-600">稼働可能時間が未設定です。{user.role === "ADMIN" && "設定画面で職種別に入力してください。"}</p>
          ) : (
            <BarList
              items={kpi.utilization.map((u) => ({ label: `${JOB_TYPE_LABEL[u.jobType]}（${u.headcount}人）`, value: u.rate }))}
              format={(v) => (v === null ? "データなし" : pct(v))}
              max={1}
            />
          )}
          <p className="mt-2 text-xs text-slate-500">iBow の実施時間 ÷ 稼働可能時間</p>
        </Card>

        <Card title="要確認">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs text-slate-500">未分類取引（この月）</dt>
              <dd className="text-lg font-semibold tabular-nums">
                {num(review.count)}件 <span className="text-sm font-normal">{yen(review.amount)}</span>
              </dd>
              {user.role !== "STAFF" && review.count > 0 && (
                <Link href={`/mos/transactions?ym=${selected.yearMonth}${origin === "SAMPLE" ? "&data=sample" : ""}`} className="text-xs text-teal-700 underline">
                  確認する
                </Link>
              )}
            </div>
            <div>
              <dt className="text-xs text-slate-500">未照合差額</dt>
              <dd className="text-lg font-semibold tabular-nums">{pl.basis === "TRIAL_BALANCE" ? yen(pl.reconciliation.unreconciledAmount) : "試算表未取込"}</dd>
              {user.role !== "STAFF" && pl.reconciliation.unreconciledAmount > 0 && (
                <Link href={`/mos/reconciliation?ym=${selected.yearMonth}${origin === "SAMPLE" ? "&data=sample" : ""}`} className="text-xs text-teal-700 underline">
                  差異を見る
                </Link>
              )}
            </div>
          </dl>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="事業所別売上の推移">
          <RevenueTrendChart data={trend} />
        </Card>
        <Card title="全社営業利益の推移">
          <ProfitTrendChart data={trend} />
        </Card>
      </div>

      <div className="mt-4">
        <Card title={`経費内訳（${ymLabel(selected.yearMonth)}・全社）`}>
          {expenses.length === 0 ? (
            <p className="text-sm text-slate-600">費用データがありません。</p>
          ) : (
            <BarList
              items={[...topExpenses.map((e) => ({ label: e.accountName, value: e.amount })), ...(otherExpense ? [{ label: "その他", value: otherExpense }] : [])]}
              format={(v) => yen(v)}
            />
          )}
          <p className="mt-3 text-xs text-slate-500">
            固定費 {yen(pl.company.fixedCost)}・変動費 {yen(pl.company.variableCost)}・人件費 {yen(pl.company.laborCost)}
            {user.role === "STAFF" && "（個人の給与が分かる科目は「人件費（合計）」にまとめて表示しています）"}
          </p>
        </Card>
      </div>
    </>
  );
}
