"use client";

import Link from "next/link";
import { usePortalStore, useCurrentStaff } from "@/lib/portal/store";
import { goalPeriodLabel, goalProgress, isAdmin, isCurrentGoal, pct, unitFiscalToDate, yen } from "@/lib/portal/logic";
import { canSeeUnitAmounts } from "@/lib/portal/permissions";
import { BUSINESS_UNITS, currentFiscalYear, unitName } from "@/lib/portal/defaults";
import { GoalSheetSummary } from "./GoalSheetPanel";
import { Goal } from "@/lib/portal/types";
import { todayString } from "@/lib/portal/util";
import { businessDays, perDay } from "@/lib/portal/workdays";
import { Card, ProgressBar, UnitBadge } from "./ui";

function monthLabel(month: string) {
  return `${Number(month.slice(5))}月`;
}

function GoalLines({ goals }: { goals: Goal[] }) {
  return (
    <ul className="space-y-2">
      {goals.map((g) => (
        <li key={g.id}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm text-slate-800">{g.title}</span>
            {g.targetValue !== null && (
              <span className="whitespace-nowrap text-[11px] text-slate-500">
                {(g.currentValue ?? 0).toLocaleString()}/{g.targetValue.toLocaleString()}
                {g.valueUnit}
              </span>
            )}
          </div>
          <ProgressBar ratio={goalProgress(g)} label={g.status === "達成" ? "達成" : undefined} />
        </li>
      ))}
    </ul>
  );
}

function CardHeader({ title, href, linkLabel }: { title: string; href: string; linkLabel: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-sm font-bold text-slate-900">{title}</h2>
      <Link href={href} className="whitespace-nowrap text-xs font-semibold text-brand-700 hover:underline">
        {linkLabel} →
      </Link>
    </div>
  );
}

/** ポータルホーム: 個人の売上・個人の目標・部門の目標 */
export function HomeGoalCards() {
  const current = useCurrentStaff();
  const personalSales = usePortalStore((s) => s.personalSales);
  const goals = usePortalStore((s) => s.goals);
  const finance = usePortalStore((s) => s.finance);
  const goalSheets = usePortalStore((s) => s.goalSheets);
  const dailySales = usePortalStore((s) => s.dailySales);
  if (!current) return null;

  const thisMonth = todayString().slice(0, 7);
  // 日次の売上(取り込み済みの最新日)
  const myDaily = dailySales.filter((d) => d.staffId === current.id).sort((a, b) => b.date.localeCompare(a.date));
  const latestDay = myDaily[0]?.date;
  const latestDayAmount = myDaily.filter((d) => d.date === latestDay).reduce((sum, d) => sum + d.amount, 0);
  // 今月の数字がまだなければ、入力済みの最新月を表示する
  const mySales = personalSales
    .filter((p) => p.staffId === current.id && p.month <= thisMonth && (p.revenue !== null || p.target !== null))
    .sort((a, b) => b.month.localeCompare(a.month))[0];
  const mySheet = goalSheets.find((g) => g.staffId === current.id && g.fiscalYear === currentFiscalYear());
  const myGoals = goals.filter((g) => g.scope === "personal" && g.staffId === current.id && isCurrentGoal(g));
  const units = isAdmin(current) ? BUSINESS_UNITS.map((u) => u.id) : [current.unitId];

  return (
    <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader title="💴 私の売上" href="/portal/goals" linkLabel="詳しく" />
        {!mySales ? (
          <p className="text-sm text-slate-400">売上の記録はまだありません。毎月、管理者・統括部長が「経営数値」で入力します。</p>
        ) : (
          <>
            <p className="text-[11px] text-slate-500">
              {mySales.month === thisMonth ? "今月" : `${monthLabel(mySales.month)}(最新)`}の実績
            </p>
            <p className="mt-0.5 text-2xl font-bold text-slate-900">{yen(mySales.revenue)}</p>
            <p className="text-xs text-slate-500">目標 {yen(mySales.target)}</p>
            <ProgressBar ratio={mySales.revenue !== null && mySales.target ? mySales.revenue / mySales.target : null} className="mt-2" />
            {(() => {
              const days = mySales.workDays ?? businessDays(mySales.month, mySales.periodEnd || undefined);
              const daily = perDay(mySales.revenue, days);
              return (
                daily !== null && (
                  <p className="mt-2 text-xs text-slate-600">
                    1日あたり <span className="text-sm font-bold text-brand-700">{yen(daily)}</span>
                    <span className="ml-1 text-slate-400">
                      (稼働{days}日{mySales.periodEnd ? `・${Number(mySales.periodEnd.slice(8))}日まで` : ""})
                    </span>
                  </p>
                )
              );
            })()}
            {mySales.visits !== null && <p className="mt-1 text-xs text-slate-600">訪問件数 {mySales.visits}件{(() => { const d = perDay(mySales.visits, mySales.workDays ?? businessDays(mySales.month, mySales.periodEnd || undefined)); return d !== null ? `(1日あたり ${d.toFixed(1)}件)` : ""; })()}</p>}
            {latestDay && (
              <p className="mt-1 text-xs text-slate-600">
                {Number(latestDay.slice(5, 7))}/{Number(latestDay.slice(8))} の売上 <span className="font-bold text-slate-800">{yen(latestDayAmount)}</span>
              </p>
            )}
          </>
        )}
      </Card>

      <Card>
        <CardHeader title="🎯 私の目標" href="/portal/goals" linkLabel="目標を入力" />
        {mySheet && (
          <div className="mb-3 rounded-lg bg-gold-50 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-700">📄 目標管理シート</span>
              <a href={mySheet.url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-brand-700 hover:underline">
                開く ↗
              </a>
            </div>
            <GoalSheetSummary sheet={mySheet} compact />
          </div>
        )}
        {myGoals.length === 0 ? (
          <p className="text-sm text-slate-400">今月・今期の行動目標はまだありません。「目標を入力」から立ててみましょう。</p>
        ) : (
          <GoalLines goals={myGoals} />
        )}
      </Card>

      <Card>
        <CardHeader title="🏢 部門の目標" href="/portal/goals" linkLabel="部門の目標" />
        <div className="space-y-4">
          {units.map((u) => {
            const fy = unitFiscalToDate(finance, u);
            const showAmounts = canSeeUnitAmounts(current, u);
            const unitGoals = goals.filter((g) => g.scope === "unit" && g.unitId === u && isCurrentGoal(g));
            const latestRatio = fy.latestRevenue !== null && fy.latestTarget ? fy.latestRevenue / fy.latestTarget : null;
            return (
              <div key={u} className="space-y-2">
                {units.length > 1 && <UnitBadge unitId={u} />}
                {!showAmounts ? null : fy.latestMonth ? (
                  <div className="space-y-1 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <span className="w-24 shrink-0">{monthLabel(fy.latestMonth)}の売上目標</span>
                      <ProgressBar ratio={latestRatio} className="flex-1" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-24 shrink-0">{fy.fy}年度 累計</span>
                      <ProgressBar ratio={fy.target ? fy.revenue / fy.target : null} className="flex-1" />
                    </div>
                    {showAmounts && (
                      <p className="text-[11px] text-slate-400">
                        {monthLabel(fy.latestMonth)} {yen(fy.latestRevenue)} / {yen(fy.latestTarget)} ・ 年間目標 {yen(fy.yearTarget)}(進捗 {pct(fy.yearTarget ? fy.revenue / fy.yearTarget : null)})
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">{unitName(u)} の売上目標はまだ入力されていません。</p>
                )}
                {unitGoals.length > 0 ? (
                  <GoalLines goals={unitGoals} />
                ) : (
                  !showAmounts && <p className="text-xs text-slate-400">今月・今期の部門の目標はまだありません。</p>
                )}
              </div>
            );
          })}
        </div>
        {units.length === 1 && <p className="mt-3 text-[11px] text-slate-400">{unitName(units[0])} ・ {goalPeriodLabel(todayString().slice(0, 7))}</p>}
      </Card>
    </div>
  );
}
