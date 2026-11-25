"use client";

import Link from "next/link";
import { useState } from "react";
import { usePortalStore, useCurrentStaff } from "@/lib/portal/store";
import { financeScope, hoursLabel, pct, sum, yen } from "@/lib/portal/logic";
import { useSync } from "@/lib/portal/sync";
import { BUSINESS_UNITS } from "@/lib/portal/defaults";
import { BusinessUnitId } from "@/lib/portal/types";
import { todayString } from "@/lib/portal/util";
import { businessDays, perDay, projectMonth } from "@/lib/portal/workdays";
import { Card, PageContainer, PageHeader, UnitBadge, buttonClass, inputClass } from "@/components/portal/ui";
import { VisitCountImport } from "@/components/portal/VisitCountImport";

/** 取り込んだ個人の売上を、月あたり・1日あたりで一覧にする */
function PersonalPerDayTable({ units, all, month, setMonth }: { units: BusinessUnitId[]; all: boolean; month: string; setMonth: (m: string) => void }) {
  const staff = usePortalStore((s) => s.staff);
  const personalSales = usePortalStore((s) => s.personalSales);
  const staffCosts = usePortalStore((s) => s.staffCosts);
  const [unit, setUnit] = useState<BusinessUnitId | "all">("all");

  const people = staff.filter((s) => s.active && (all ? unit === "all" || s.unitId === unit : units.includes(s.unitId)));
  const rows = people
    .map((p) => ({ person: p, rec: personalSales.find((x) => x.staffId === p.id && x.month === month) }))
    .filter((r) => r.rec && (r.rec.revenue !== null || r.rec.visits !== null))
    .sort((a, b) => (b.rec?.revenue ?? 0) - (a.rec?.revenue ?? 0));
  const days = (r: (typeof rows)[number]) => r.rec?.workDays ?? businessDays(month, r.rec?.periodEnd || undefined);
  const partial = rows.find((r) => r.rec?.periodEnd)?.rec?.periodEnd;
  const totalRevenue = sum(rows.map((r) => r.rec?.revenue));
  const totalVisits = sum(rows.map((r) => r.rec?.visits));
  const totalDays = sum(rows.map((r) => days(r)));

  return (
    <Card className="p-0 sm:p-0">
      <div className="flex flex-col gap-2 px-4 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-900">個人の売上(月あたり・1日あたり)</h2>
          <p className="text-[11px] text-slate-500">
            1日あたり = 月の売上 ÷ 稼働日数。
            {partial
              ? `${Number(partial.slice(8))}日までのデータです(月末見込み = 1日あたり × 月の営業日数 ${businessDays(month)}日)。`
              : `この月の営業日(土日祝を除く)は ${businessDays(month)}日です。`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {all && (
            <select className={`${inputClass} w-auto`} value={unit} onChange={(e) => setUnit(e.target.value as BusinessUnitId | "all")}>
              <option value="all">全事業所</option>
              {BUSINESS_UNITS.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          )}
          <input type="month" className={`${inputClass} w-auto`} value={month} onChange={(e) => setMonth(e.target.value || todayString().slice(0, 7))} />
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-slate-400">この月の個人売上はまだ取り込まれていません。上のファイルを取り込んでください。</p>
      ) : (
        <div className="overflow-x-auto p-2">
          <table className="w-full min-w-[1080px] text-sm">
            <thead className="text-xs text-slate-500">
              <tr className="text-right">
                <th className="px-2 py-1.5 text-left font-semibold">氏名</th>
                <th className="px-2 py-1.5 font-semibold">月の売上</th>
                <th className="px-2 py-1.5 font-semibold">稼働日数</th>
                <th className="px-2 py-1.5 font-semibold">1日あたり売上</th>
                <th className="px-2 py-1.5 font-semibold">訪問件数</th>
                <th className="px-2 py-1.5 font-semibold">1日あたり件数</th>
                <th className="px-2 py-1.5 font-semibold">1件あたり</th>
                <th className="px-2 py-1.5 font-semibold">訪問時間</th>
                <th className="px-2 py-1.5 font-semibold">1日あたり時間</th>
                {partial && <th className="px-2 py-1.5 font-semibold">月末見込み</th>}
                <th className="px-2 py-1.5 font-semibold">利益ライン</th>
                <th className="px-2 py-1.5 font-semibold">目標</th>
                <th className="px-2 py-1.5 font-semibold">達成率</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-right">
              {rows.map((r) => {
                const rec = r.rec!;
                const d = days(r);
                const projected = rec.periodEnd ? projectMonth(rec.revenue, d, month) : rec.revenue;
                return (
                  <tr key={r.person.id}>
                    <td className="whitespace-nowrap px-2 py-1.5 text-left">
                      <span className="font-medium">{r.person.name}</span> <UnitBadge unitId={r.person.unitId} />
                    </td>
                    <td className="px-2 py-1.5 font-mono font-bold">{yen(rec.revenue)}</td>
                    <td className="px-2 py-1.5">{d}日</td>
                    <td className="px-2 py-1.5 font-mono font-bold text-brand-700">{yen(perDay(rec.revenue, d))}</td>
                    <td className="px-2 py-1.5">{rec.visits ?? "-"}</td>
                    <td className="px-2 py-1.5">{perDay(rec.visits, d)?.toFixed(1) ?? "-"}</td>
                    <td className="px-2 py-1.5 font-mono text-xs">{yen(rec.visits ? (rec.revenue ?? 0) / rec.visits : null)}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-xs">{hoursLabel(rec.visitMinutes)}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-xs">{hoursLabel(perDay(rec.visitMinutes, d))}</td>
                    {partial && <td className="px-2 py-1.5 font-mono text-xs">{yen(projected)}</td>}
                    <td className="px-2 py-1.5 font-mono text-xs">
                      {(() => {
                        const line = staffCosts.find((c) => c.staffId === r.person.id)?.profitLine ?? null;
                        if (line === null) return "-";
                        return <span className={(projected ?? 0) >= line ? "text-emerald-700" : "text-rose-600"}>{yen(line)}</span>;
                      })()}
                    </td>
                    <td className="px-2 py-1.5 font-mono text-xs">{yen(rec.target)}</td>
                    <td className="px-2 py-1.5 text-xs">{pct(rec.target ? (projected ?? 0) / rec.target : null)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t-2 border-slate-200 text-right font-bold">
              <tr>
                <td className="px-2 py-2 text-left">合計・平均({rows.length}名)</td>
                <td className="px-2 py-2 font-mono">{yen(totalRevenue)}</td>
                <td className="px-2 py-2 text-xs font-normal text-slate-500">平均 {(totalDays / rows.length).toFixed(1)}日</td>
                <td className="px-2 py-2 font-mono text-brand-700">{yen(perDay(totalRevenue, totalDays))}</td>
                <td className="px-2 py-2">{totalVisits}</td>
                <td className="px-2 py-2">{perDay(totalVisits, totalDays)?.toFixed(1) ?? "-"}</td>
                <td className="px-2 py-2 font-mono text-xs">{yen(totalVisits ? totalRevenue / totalVisits : null)}</td>
                <td className="whitespace-nowrap px-2 py-2 text-xs">{hoursLabel(sum(rows.map((r) => r.rec?.visitMinutes)))}</td>
                <td colSpan={partial ? 5 : 4} />
              </tr>
            </tfoot>
          </table>
          <p className="px-2 pt-2 text-[11px] text-slate-400">
            ※ 1日あたりの合計欄は「全員の売上 ÷ 全員の稼働日数の合計」(1人1日あたりの平均)です。稼働日数は取り込み時に個人ごとに変更できます。目標の達成率は{partial ? "月末見込み" : "月の売上"}で計算しています。
          </p>
        </div>
      )}
    </Card>
  );
}

export default function SalesUploadPage() {
  const current = useCurrentStaff();
  const scope = financeScope(current);
  const units: BusinessUnitId[] = scope.all ? BUSINESS_UNITS.map((u) => u.id) : scope.units;
  const personalSales = usePortalStore((s) => s.personalSales);
  // 一覧の月: 取り込み済みの最新の月(取り込んだらその月に切り替える)
  const [month, setMonth] = useState(() => {
    const now = todayString().slice(0, 7);
    return personalSales.filter((p) => p.month <= now && p.revenue !== null).map((p) => p.month).sort().pop() ?? now;
  });

  const syncMode = useSync((s) => s.mode);
  if (!scope.all && units.length === 0) {
    return (
      <PageContainer>
        <PageHeader icon="📥" title="売上データ取り込み" description="iBow・ZESTのデータを取り込み、個人の売上を計算します。" />
        <Card>
          <p className="text-sm text-slate-600">売上データの取り込みは、管理者・統括部長・経営者が行います。</p>
          <p className="mt-2 text-sm text-slate-600">
            自分の売上(月あたり・1日あたり)は{" "}
            <Link href="/portal" className="font-semibold text-brand-700 hover:underline">
              ポータルホーム
            </Link>{" "}
            と「経営数値」→「個人の売上・目標」で確認できます。
          </p>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        icon="📥"
        title="売上データ取り込み"
        description="iBowの「訪問件数詳細表(職員別)」をアップロードすると、件数×報酬単価で個人の売上を計算し、月あたり・1日あたりの売上に反映します。"
        actions={
          <Link href="/portal/management" className={buttonClass.secondary}>
            📈 経営数値へ
          </Link>
        }
      />
      {syncMode !== "server" && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          ⚠ いまは取り込んだ売上が<strong>この端末(ブラウザ)だけ</strong>に保存されます。職員が自分のスマートフォン・パソコンで見ても反映されません。
          全職員に反映するには、「設定・マスタ」→「データ管理」でサーバー共有に切り替えてください。
        </div>
      )}
      <ol className="mb-4 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
        {[
          ["1", "iBowで「訪問件数詳細表(職員別)」をExcelで出力"],
          ["2", "下の「Excelファイルを選ぶ」で選び、対象の月・集計の最終日・稼働日数を確認"],
          ["3", "「売上として取り込む」を押すと個人の売上・1日あたりに反映"],
        ].map(([n, t]) => (
          <li key={n} className="flex items-start gap-2 rounded-lg bg-white p-3 ring-1 ring-slate-200">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white">{n}</span>
            {t}
          </li>
        ))}
      </ol>
      <div className="space-y-5">
        <VisitCountImport onImported={setMonth} />
        <PersonalPerDayTable units={units} all={scope.all} month={month} setMonth={setMonth} />
        <Card>
          <h2 className="text-sm font-bold text-slate-900">日ごとの実績CSV(ZEST・iBow)</h2>
          <p className="mt-1 text-xs text-slate-500">
            日付・担当者・金額の入った実績CSVを毎日取り込む場合は「経営数値」→「日次売上(取り込み)」から行えます。取り込んだ日は、その日の実績から1日あたりを計算できます。
          </p>
          <Link href="/portal/management" className={`${buttonClass.secondary} mt-3 inline-flex`}>
            日次売上の取り込みを開く
          </Link>
        </Card>
      </div>
    </PageContainer>
  );
}
