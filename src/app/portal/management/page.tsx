"use client";

import { FormEvent, useMemo, useState } from "react";
import clsx from "clsx";
import { usePortalStore, useCurrentStaff, useStaffName } from "@/lib/portal/store";
import { financeScope, manYen, pct, sum, yen } from "@/lib/portal/logic";
import { BUSINESS_UNITS, currentFiscalYear, fiscalMonths, unitName } from "@/lib/portal/defaults";
import { BusinessUnitId, FinanceMonthly, PersonalSales, Staff, Subsidy, SubsidyStatus } from "@/lib/portal/types";
import { formatDate, newId } from "@/lib/portal/util";
import { MarginChart, MonthPoint, RevenueTargetChart } from "@/components/portal/FinanceCharts";
import {
  Card,
  EmptyState,
  Field,
  PageContainer,
  PageHeader,
  StatusPill,
  UnitBadge,
  UnitBadges,
  UnitCheckboxes,
  buttonClass,
  inputClass,
} from "@/components/portal/ui";

type Tab = "summary" | "monthly" | "personal" | "subsidy";
const SUBSIDY_STATUSES: SubsidyStatus[] = ["申請予定", "申請中", "採択・交付決定", "入金済", "不採択"];
const cell = `${inputClass} py-1 text-right font-mono`;

const monthLabel = (m: string) => `${Number(m.slice(5))}月`;
const numOrNull = (v: string) => (v === "" ? null : Number(v));

function fyRange(fy: number) {
  return { from: `${fy}-04-01`, to: `${fy + 1}-03-31` };
}

function subsidyDate(s: Subsidy) {
  return s.receivedDate || s.appliedDate;
}

/** 事業所群・月ごとの合計 */
function aggregate(finance: FinanceMonthly[], units: BusinessUnitId[], months: string[]) {
  return months.map((month) => {
    const rows = finance.filter((f) => f.month === month && units.includes(f.unitId));
    const hasRevenue = rows.some((r) => r.revenue !== null);
    const revenue = hasRevenue ? sum(rows.map((r) => r.revenue)) : null;
    const target = rows.some((r) => r.revenueTarget !== null) ? sum(rows.map((r) => r.revenueTarget)) : null;
    const labor = sum(rows.map((r) => r.laborCost));
    const other = sum(rows.map((r) => r.otherCost));
    const profit = revenue === null ? null : revenue - labor - other;
    return { month, revenue, target, labor, other, profit, margin: revenue ? (profit ?? 0) / revenue : null };
  });
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-[11px] font-semibold text-slate-500">{label}</p>
      <p className="mt-0.5 text-lg font-bold text-slate-900 sm:text-xl">{value}</p>
      {sub && <p className={clsx("text-[11px]", tone === "good" ? "text-emerald-700" : tone === "bad" ? "text-rose-600" : "text-slate-500")}>{sub}</p>}
    </div>
  );
}

function AchievementBar({ ratio }: { ratio: number | null }) {
  if (ratio === null) return <span className="text-slate-400">-</span>;
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
        <span className={clsx("block h-full rounded-full", ratio >= 1 ? "bg-emerald-500" : "bg-amber-500")} style={{ width: `${Math.min(1, ratio) * 100}%` }} />
      </span>
      <span className={clsx("text-xs font-semibold", ratio >= 1 ? "text-emerald-700" : "text-slate-700")}>{pct(ratio)}</span>
    </span>
  );
}

export default function ManagementPage() {
  const finance = usePortalStore((s) => s.finance);
  const subsidies = usePortalStore((s) => s.subsidies);
  const personalSales = usePortalStore((s) => s.personalSales);
  const staff = usePortalStore((s) => s.staff);
  const financeIsSample = usePortalStore((s) => s.financeIsSample);
  const clearFinanceSamples = usePortalStore((s) => s.clearFinanceSamples);
  const current = useCurrentStaff();
  const staffName = useStaffName();

  const scope = financeScope(current);
  const allowedUnits: BusinessUnitId[] = scope.all ? BUSINESS_UNITS.map((u) => u.id) : scope.units;
  const canSeeUnits = allowedUnits.length > 0;

  const [tab, setTab] = useState<Tab>(canSeeUnits ? "summary" : "personal");
  const [fy, setFy] = useState(currentFiscalYear());
  const [unitSel, setUnitSel] = useState<BusinessUnitId | "all">(scope.all ? "all" : allowedUnits[0] ?? "houkan");
  // 個人売上は前月分を初期表示(当月はまだ締まっていないため)
  const [personalMonth, setPersonalMonth] = useState(() => {
    const d = new Date();
    const x = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`;
  });

  const months = fiscalMonths(fy);
  const fyOptions = useMemo(() => {
    const years = new Set([currentFiscalYear(), currentFiscalYear() - 1, ...finance.map((f) => currentFiscalYear(new Date(`${f.month}-01T00:00:00`)))]);
    return [...years].sort((a, b) => b - a);
  }, [finance]);

  const selectedUnits = unitSel === "all" ? allowedUnits : [unitSel];
  const series = aggregate(finance, selectedUnits, months);
  const chartData: MonthPoint[] = series.map((s) => ({ label: monthLabel(s.month), revenue: s.revenue, target: s.target, margin: s.margin }));

  const filled = series.filter((s) => s.revenue !== null);
  const annual = {
    revenue: sum(filled.map((s) => s.revenue)),
    targetToDate: sum(filled.map((s) => s.target)),
    targetYear: sum(series.map((s) => s.target)),
    labor: sum(filled.map((s) => s.labor)),
    profit: sum(filled.map((s) => s.profit)),
  };
  const range = fyRange(fy);
  const visibleSubsidies = subsidies.filter((s) => scope.all || s.units.length === 0 || s.units.some((u) => allowedUnits.includes(u)));
  const fySubsidies = visibleSubsidies.filter((s) => {
    const d = subsidyDate(s);
    return d >= range.from && d <= range.to && (unitSel === "all" || s.units.length === 0 || s.units.includes(unitSel));
  });
  const subsidyReceived = sum(fySubsidies.filter((s) => s.status === "入金済").map((s) => s.amount));
  const subsidyExpected = sum(fySubsidies.filter((s) => s.status === "採択・交付決定").map((s) => s.amount));
  const lastMonth = filled[filled.length - 1];

  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: "summary", label: "経営サマリー", show: canSeeUnits },
    { id: "monthly", label: "月次の数字を入力", show: canSeeUnits },
    { id: "personal", label: "個人の売上・目標", show: true },
    { id: "subsidy", label: "補助金", show: canSeeUnits },
  ];

  return (
    <PageContainer>
      <PageHeader
        icon="📈"
        title="経営数値"
        description={
          scope.all
            ? "全事業所の売上・利益・補助金・個人の実績を確認します(経営者・統括部長・事務長のみ全社を表示)。"
            : scope.units.length
              ? `${unitName(scope.units[0])} の数字を表示しています(所長権限)。`
              : "あなたの個人の売上と目標を表示しています。"
        }
        actions={
          tab !== "personal" &&
          canSeeUnits && (
            <select className={`${inputClass} w-auto`} value={fy} onChange={(e) => setFy(Number(e.target.value))}>
              {fyOptions.map((y) => (
                <option key={y} value={y}>
                  {y}年度(4月〜3月)
                </option>
              ))}
            </select>
          )
        }
      />

      {financeIsSample && scope.all && (
        <div className="mb-4 flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 sm:flex-row sm:items-center sm:justify-between">
          <span>⚠ 表示中の売上・利益・補助金・個人売上は<strong>サンプルの数字</strong>です。</span>
          <button
            type="button"
            className={buttonClass.secondary}
            onClick={() => confirm("サンプルの経営数値(月次・補助金・個人売上)をすべて消去しますか?") && clearFinanceSamples()}
          >
            サンプルを消去して実データを入力する
          </button>
        </div>
      )}

      <div className="mb-5 flex flex-wrap gap-1 border-b border-slate-200">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={clsx(
                "-mb-px border-b-2 px-3 py-2 text-sm font-semibold",
                tab === t.id ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800"
              )}
            >
              {t.label}
            </button>
          ))}
      </div>

      {(tab === "summary" || tab === "monthly") && scope.all && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {(["all", ...allowedUnits] as const).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setUnitSel(tab === "monthly" && u === "all" ? "houkan" : u)}
              disabled={tab === "monthly" && u === "all"}
              className={clsx(
                "rounded-full px-3 py-1.5 text-xs font-semibold disabled:hidden",
                unitSel === u ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              )}
            >
              {u === "all" ? "全社合計" : unitName(u)}
            </button>
          ))}
        </div>
      )}

      {tab === "summary" && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              label={`${fy}年度 売上(累計)`}
              value={manYen(annual.revenue)}
              sub={annual.targetToDate ? `同期間の目標比 ${pct(annual.revenue / annual.targetToDate)}` : undefined}
              tone={annual.targetToDate && annual.revenue >= annual.targetToDate ? "good" : "bad"}
            />
            <Kpi label="年間売上目標" value={manYen(annual.targetYear)} sub={annual.targetYear ? `進捗 ${pct(annual.revenue / annual.targetYear)}` : "目標未設定"} />
            <Kpi
              label="営業利益(累計)・利益率"
              value={manYen(annual.profit)}
              sub={`利益率 ${pct(annual.revenue ? annual.profit / annual.revenue : null)} ・ 人件費率 ${pct(annual.revenue ? annual.labor / annual.revenue : null)}`}
              tone={annual.profit >= 0 ? "good" : "bad"}
            />
            <Kpi
              label="補助金(入金済)"
              value={manYen(subsidyReceived)}
              sub={`補助金込み利益 ${manYen(annual.profit + subsidyReceived)}${subsidyExpected ? ` ・ 入金予定 ${manYen(subsidyExpected)}` : ""}`}
            />
          </div>
          {lastMonth && (
            <p className="mt-2 text-xs text-slate-500">
              直近({monthLabel(lastMonth.month)}): 売上 {yen(lastMonth.revenue)} ・ 目標 {yen(lastMonth.target)} ・ 利益 {yen(lastMonth.profit)} ・ 利益率 {pct(lastMonth.margin)}
            </p>
          )}

          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <h2 className="text-sm font-bold text-slate-900">月別の売上と目標</h2>
              <p className="mb-2 text-[11px] text-slate-400">{unitSel === "all" ? "全社合計" : unitName(unitSel)} ・ 棒 = 売上、破線 = 目標</p>
              <RevenueTargetChart data={chartData} />
            </Card>
            <Card className="lg:col-span-2">
              <h2 className="text-sm font-bold text-slate-900">月別の利益率</h2>
              <p className="mb-2 text-[11px] text-slate-400">(売上 − 人件費 − その他経費)÷ 売上</p>
              <MarginChart data={chartData} height={260} />
            </Card>
          </div>

          {scope.all && unitSel === "all" && (
            <Card className="mt-4 p-0 sm:p-0">
              <h2 className="px-4 pt-4 text-sm font-bold text-slate-900">事業所別({fy}年度 累計)</h2>
              <div className="overflow-x-auto p-2">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="text-xs text-slate-500">
                    <tr className="text-right">
                      <th className="px-2 py-1.5 text-left font-semibold">事業所</th>
                      <th className="px-2 py-1.5 font-semibold">売上</th>
                      <th className="px-2 py-1.5 font-semibold">年間目標</th>
                      <th className="px-2 py-1.5 text-left font-semibold">目標達成(同期間)</th>
                      <th className="px-2 py-1.5 font-semibold">人件費</th>
                      <th className="px-2 py-1.5 font-semibold">その他経費</th>
                      <th className="px-2 py-1.5 font-semibold">利益</th>
                      <th className="px-2 py-1.5 font-semibold">利益率</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-right font-mono">
                    {allowedUnits.map((u) => {
                      const s = aggregate(finance, [u], months).filter((x) => x.revenue !== null);
                      const rev = sum(s.map((x) => x.revenue));
                      const tgt = sum(s.map((x) => x.target));
                      const profit = sum(s.map((x) => x.profit));
                      return (
                        <tr key={u}>
                          <td className="px-2 py-2 text-left font-sans">
                            <UnitBadge unitId={u} />
                          </td>
                          <td className="px-2 py-2">{yen(rev)}</td>
                          <td className="px-2 py-2">{yen(sum(aggregate(finance, [u], months).map((x) => x.target)))}</td>
                          <td className="px-2 py-2 text-left font-sans">
                            <AchievementBar ratio={tgt ? rev / tgt : null} />
                          </td>
                          <td className="px-2 py-2">{yen(sum(s.map((x) => x.labor)))}</td>
                          <td className="px-2 py-2">{yen(sum(s.map((x) => x.other)))}</td>
                          <td className={clsx("px-2 py-2 font-bold", profit < 0 && "text-rose-600")}>{yen(profit)}</td>
                          <td className="px-2 py-2">{pct(rev ? profit / rev : null)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <Card className="mt-4 p-0 sm:p-0">
            <h2 className="px-4 pt-4 text-sm font-bold text-slate-900">月別の明細(表)</h2>
            <div className="overflow-x-auto p-2">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-xs text-slate-500">
                  <tr className="text-right">
                    {["月", "売上", "目標", "達成率", "人件費", "その他経費", "利益", "利益率"].map((h, i) => (
                      <th key={h} className={clsx("px-2 py-1.5 font-semibold", i === 0 && "text-left")}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-right font-mono">
                  {series.map((s) => (
                    <tr key={s.month} className={s.revenue === null ? "text-slate-300" : ""}>
                      <td className="px-2 py-1.5 text-left font-sans">{s.month.replace("-", "/")}</td>
                      <td className="px-2 py-1.5">{yen(s.revenue)}</td>
                      <td className="px-2 py-1.5">{yen(s.target)}</td>
                      <td className="px-2 py-1.5">{pct(s.revenue !== null && s.target ? s.revenue / s.target : null)}</td>
                      <td className="px-2 py-1.5">{s.revenue === null ? "-" : yen(s.labor)}</td>
                      <td className="px-2 py-1.5">{s.revenue === null ? "-" : yen(s.other)}</td>
                      <td className={clsx("px-2 py-1.5", (s.profit ?? 0) < 0 && "text-rose-600")}>{yen(s.profit)}</td>
                      <td className="px-2 py-1.5">{pct(s.margin)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {tab === "monthly" && <MonthlyInput unitId={unitSel === "all" ? allowedUnits[0] : unitSel} months={months} />}

      {tab === "personal" && (
        <PersonalTab
          current={current}
          scopeAll={scope.all}
          scopeUnits={scope.units}
          month={personalMonth}
          setMonth={setPersonalMonth}
          staff={staff}
          personalSales={personalSales}
          staffName={staffName}
        />
      )}

      {tab === "subsidy" && <SubsidyTab subsidies={visibleSubsidies} canEdit={scope.all} />}

    </PageContainer>
  );
}

function MonthlyInput({ unitId, months }: { unitId: BusinessUnitId; months: string[] }) {
  const finance = usePortalStore((s) => s.finance);
  const collection = usePortalStore((s) => s.collection);

  function setValue(month: string, patch: Partial<FinanceMonthly>) {
    const existing = finance.find((f) => f.unitId === unitId && f.month === month);
    if (existing) collection("finance").update(existing.id, patch);
    else
      collection("finance").add({
        id: newId("fin"),
        unitId,
        month,
        revenue: null,
        revenueTarget: null,
        laborCost: null,
        otherCost: null,
        notes: "",
        ...patch,
      });
  }

  function copyTargetDown() {
    const first = finance.find((f) => f.unitId === unitId && f.month === months[0]);
    if (!first?.revenueTarget) {
      alert("4月の目標を先に入力してください。");
      return;
    }
    if (!confirm(`4月の目標(${yen(first.revenueTarget)})を5月〜3月にもコピーしますか?`)) return;
    months.slice(1).forEach((m) => setValue(m, { revenueTarget: first.revenueTarget }));
  }

  return (
    <Card className="p-0 sm:p-0">
      <div className="flex flex-col gap-2 px-4 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
            月次の数字 <UnitBadge unitId={unitId} />
          </h2>
          <p className="text-[11px] text-slate-400">金額は円で入力。入力すると自動で保存され、利益・利益率を計算します。</p>
        </div>
        <button type="button" className={buttonClass.secondary} onClick={copyTargetDown}>
          4月の目標を全月にコピー
        </button>
      </div>
      <div className="overflow-x-auto p-2">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="text-xs text-slate-500">
            <tr className="text-right">
              {["月", "売上", "売上目標", "人件費", "その他経費", "利益", "利益率", "メモ"].map((h, i) => (
                <th key={h} className={clsx("px-1.5 py-1.5 font-semibold", (i === 0 || i === 7) && "text-left")}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {months.map((m) => {
              const f = finance.find((x) => x.unitId === unitId && x.month === m);
              const profit = f?.revenue != null ? f.revenue - (f.laborCost ?? 0) - (f.otherCost ?? 0) : null;
              const numInput = (key: "revenue" | "revenueTarget" | "laborCost" | "otherCost") => (
                <input
                  type="number"
                  inputMode="numeric"
                  className={cell}
                  value={f?.[key] ?? ""}
                  onChange={(e) => setValue(m, { [key]: numOrNull(e.target.value) })}
                  aria-label={`${m} ${key}`}
                />
              );
              return (
                <tr key={m}>
                  <td className="whitespace-nowrap px-1.5 py-1 text-left">{m.replace("-", "/")}</td>
                  <td className="px-1.5 py-1">{numInput("revenue")}</td>
                  <td className="px-1.5 py-1">{numInput("revenueTarget")}</td>
                  <td className="px-1.5 py-1">{numInput("laborCost")}</td>
                  <td className="px-1.5 py-1">{numInput("otherCost")}</td>
                  <td className={clsx("px-1.5 py-1 text-right font-mono", (profit ?? 0) < 0 && "text-rose-600")}>{yen(profit)}</td>
                  <td className="px-1.5 py-1 text-right font-mono">{pct(f?.revenue ? (profit ?? 0) / f.revenue : null)}</td>
                  <td className="px-1.5 py-1">
                    <input className={`${inputClass} py-1`} value={f?.notes ?? ""} onChange={(e) => setValue(m, { notes: e.target.value })} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function PersonalTab({
  current,
  scopeAll,
  scopeUnits,
  month,
  setMonth,
  staff,
  personalSales,
  staffName,
}: {
  current: Staff | undefined;
  scopeAll: boolean;
  scopeUnits: BusinessUnitId[];
  month: string;
  setMonth: (m: string) => void;
  staff: Staff[];
  personalSales: PersonalSales[];
  staffName: (id: string) => string;
}) {
  const collection = usePortalStore((s) => s.collection);
  const canEdit = scopeAll || scopeUnits.length > 0;
  const [unit, setUnit] = useState<BusinessUnitId | "all">("all");

  const people = staff.filter(
    (s) =>
      s.active &&
      (scopeAll ? unit === "all" || s.unitId === unit : scopeUnits.length ? scopeUnits.includes(s.unitId) : s.id === current?.id)
  );

  function setValue(staffId: string, patch: Partial<PersonalSales>) {
    const existing = personalSales.find((p) => p.staffId === staffId && p.month === month);
    if (existing) collection("personalSales").update(existing.id, patch);
    else collection("personalSales").add({ id: newId("ps"), staffId, month, revenue: null, target: null, visits: null, ...patch });
  }

  // 本人の直近12か月
  const myHistory: MonthPoint[] = useMemo(() => {
    if (!current) return [];
    const d = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const x = new Date(d.getFullYear(), d.getMonth() - 11 + i, 1);
      const m = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`;
      const r = personalSales.find((p) => p.staffId === current.id && p.month === m);
      return { label: monthLabel(m), revenue: r?.revenue ?? null, target: r?.target ?? null, margin: null };
    });
  }, [current, personalSales]);

  const rows = people.map((p) => ({ person: p, rec: personalSales.find((x) => x.staffId === p.id && x.month === month) }));
  const totalRevenue = sum(rows.map((r) => r.rec?.revenue));
  const totalTarget = sum(rows.map((r) => r.rec?.target));

  return (
    <div className="space-y-4">
      {current && (
        <Card>
          <h2 className="text-sm font-bold text-slate-900">{current.name} さんの売上と目標(直近12か月)</h2>
          {myHistory.every((h) => h.revenue === null && h.target === null) ? (
            <p className="mt-2 text-sm text-slate-400">まだ記録がありません。</p>
          ) : (
            <RevenueTargetChart data={myHistory} height={220} />
          )}
        </Card>
      )}

      {(canEdit || people.length > 0) && (
        <Card className="p-0 sm:p-0">
          <div className="flex flex-col gap-2 px-4 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-bold text-slate-900">個人別の実績</h2>
            <div className="flex flex-wrap gap-2">
              {scopeAll && (
                <select className={`${inputClass} w-auto`} value={unit} onChange={(e) => setUnit(e.target.value as BusinessUnitId | "all")}>
                  <option value="all">全事業所</option>
                  {BUSINESS_UNITS.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              )}
              <input type="month" className={`${inputClass} w-auto`} value={month} onChange={(e) => setMonth(e.target.value)} />
            </div>
          </div>
          <div className="overflow-x-auto p-2">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-xs text-slate-500">
                <tr className="text-right">
                  {["氏名", "役職", "売上", "目標", "達成率", "訪問件数"].map((h, i) => (
                    <th key={h} className={clsx("px-1.5 py-1.5 font-semibold", i < 2 && "text-left")}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(({ person, rec }) => {
                  const ratio = rec?.revenue != null && rec.target ? rec.revenue / rec.target : null;
                  const field = (key: "revenue" | "target" | "visits") =>
                    canEdit ? (
                      <input
                        type="number"
                        inputMode="numeric"
                        className={cell}
                        value={rec?.[key] ?? ""}
                        onChange={(e) => setValue(person.id, { [key]: numOrNull(e.target.value) })}
                        aria-label={`${person.name} ${key}`}
                      />
                    ) : (
                      <span className="font-mono">{key === "visits" ? (rec?.visits ?? "-") : yen(rec?.[key])}</span>
                    );
                  return (
                    <tr key={person.id}>
                      <td className="whitespace-nowrap px-1.5 py-1.5">
                        <span className="font-medium">{staffName(person.id)}</span> <UnitBadge unitId={person.unitId} />
                      </td>
                      <td className="px-1.5 py-1.5 text-xs text-slate-500">{person.position}</td>
                      <td className="px-1.5 py-1 text-right">{field("revenue")}</td>
                      <td className="px-1.5 py-1 text-right">{field("target")}</td>
                      <td className="px-1.5 py-1">
                        <span className="flex justify-end">
                          <AchievementBar ratio={ratio} />
                        </span>
                      </td>
                      <td className="w-24 px-1.5 py-1 text-right">{field("visits")}</td>
                    </tr>
                  );
                })}
              </tbody>
              {rows.length > 1 && (
                <tfoot className="border-t-2 border-slate-200 text-right font-mono text-sm font-bold">
                  <tr>
                    <td className="px-1.5 py-2 text-left font-sans" colSpan={2}>
                      合計
                    </td>
                    <td className="px-3 py-2">{yen(totalRevenue)}</td>
                    <td className="px-3 py-2">{yen(totalTarget)}</td>
                    <td className="px-1.5 py-2">{pct(totalTarget ? totalRevenue / totalTarget : null)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          {!canEdit && <p className="px-4 pb-3 text-[11px] text-slate-400">数字の入力は所長・事務長が行います。</p>}
        </Card>
      )}
    </div>
  );
}

function SubsidyTab({ subsidies, canEdit }: { subsidies: Subsidy[]; canEdit: boolean }) {
  const collection = usePortalStore((s) => s.collection);
  const blank = (): Omit<Subsidy, "id"> => ({ name: "", units: [], amount: 0, status: "申請予定", appliedDate: "", receivedDate: "", notes: "" });
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [show, setShow] = useState(false);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (editingId) collection("subsidies").update(editingId, form);
    else collection("subsidies").add({ ...form, id: newId("sub") });
    setShow(false);
    setEditingId(null);
    setForm(blank());
  }

  const byStatus = SUBSIDY_STATUSES.map((st) => ({ st, total: sum(subsidies.filter((s) => s.status === st).map((s) => s.amount)) }));
  const sorted = [...subsidies].sort((a, b) => subsidyDate(b).localeCompare(subsidyDate(a)));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {byStatus.map(({ st, total }) => (
          <Kpi key={st} label={st} value={manYen(total)} />
        ))}
      </div>

      {canEdit && !show && (
        <button type="button" className={buttonClass.primary} onClick={() => setShow(true)}>
          ＋ 補助金・助成金を追加
        </button>
      )}
      {show && (
        <Card className="border-brand-300">
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Field label="名称" required className="col-span-2">
                <input className={inputClass} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="金額(円)" required>
                <input type="number" min={0} className={inputClass} required value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) || 0 })} />
              </Field>
              <Field label="状況">
                <select className={inputClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as SubsidyStatus })}>
                  {SUBSIDY_STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="申請日">
                <input type="date" className={inputClass} value={form.appliedDate} onChange={(e) => setForm({ ...form, appliedDate: e.target.value })} />
              </Field>
              <Field label="入金日">
                <input type="date" className={inputClass} value={form.receivedDate} onChange={(e) => setForm({ ...form, receivedDate: e.target.value })} />
              </Field>
              <Field label="メモ(実績報告の期限など)" className="col-span-2">
                <input className={inputClass} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </Field>
            </div>
            <Field group label="対象の事業所" hint="選ばない場合は全社">
              <UnitCheckboxes value={form.units} onChange={(units) => setForm({ ...form, units })} />
            </Field>
            <div className="flex gap-2">
              <button type="submit" className={buttonClass.primary}>
                保存する
              </button>
              <button
                type="button"
                className={buttonClass.secondary}
                onClick={() => {
                  setShow(false);
                  setEditingId(null);
                }}
              >
                キャンセル
              </button>
            </div>
          </form>
        </Card>
      )}

      {sorted.length === 0 ? (
        <EmptyState>補助金・助成金の記録はありません。</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                {["名称", "対象", "金額", "状況", "申請日", "入金日", "メモ", ""].map((h) => (
                  <th key={h} className="px-3 py-2 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sorted.map((s) => (
                <tr key={s.id}>
                  <td className="px-3 py-2 font-medium">{s.name}</td>
                  <td className="px-3 py-2">
                    <UnitBadges units={s.units} />
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{yen(s.amount)}</td>
                  <td className="px-3 py-2">
                    <StatusPill tone={s.status === "入金済" ? "ok" : s.status === "不採択" ? "neutral" : s.status === "採択・交付決定" ? "info" : "warn"}>
                      {s.status}
                    </StatusPill>
                  </td>
                  <td className="px-3 py-2 text-xs">{s.appliedDate ? formatDate(s.appliedDate) : "-"}</td>
                  <td className="px-3 py-2 text-xs">{s.receivedDate ? formatDate(s.receivedDate) : "-"}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{s.notes}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {canEdit && (
                      <>
                        <button
                          type="button"
                          className={buttonClass.ghost}
                          onClick={() => {
                            const { id, ...rest } = s;
                            setEditingId(id);
                            setForm(rest);
                            setShow(true);
                          }}
                        >
                          編集
                        </button>
                        <button type="button" className={buttonClass.danger} onClick={() => confirm(`「${s.name}」を削除しますか?`) && collection("subsidies").remove(s.id)}>
                          削除
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
