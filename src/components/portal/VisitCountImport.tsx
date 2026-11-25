"use client";

import { ChangeEvent, useMemo, useState } from "react";
import { usePortalStore } from "@/lib/portal/store";
import { yen } from "@/lib/portal/logic";
import { BUSINESS_UNITS, unitName } from "@/lib/portal/defaults";
import { matchStaff, mergeDailySales, recomputePersonalSales } from "@/lib/portal/salesImport";
import { estimateSales, parseVisitCountSheet, VisitCountSheet } from "@/lib/portal/visitCount";
import { BusinessUnitId, PersonalSales } from "@/lib/portal/types";
import { daysAgo, formatDate, newId, todayString } from "@/lib/portal/util";
import { businessDays, monthEnd, perDay, projectMonth } from "@/lib/portal/workdays";
import { Card, Field, buttonClass, inputClass } from "./ui";

type Mode = "month" | "day";

/** iBow「訪問件数詳細表(職員別)」のExcelから、件数×報酬単価で売上を概算して取り込む */
export function VisitCountImport({ onImported }: { onImported?: (month: string) => void } = {}) {
  const staff = usePortalStore((s) => s.staff);
  const feeRates = usePortalStore((s) => s.feeRates);
  const savedRegionUnitPrice = usePortalStore((s) => s.regionUnitPrice);
  // この取り込みだけで使う単価(保存されている単価は「設定・マスタ」→「報酬単価」で変更)
  const [regionOverride, setRegionOverride] = useState<number | null>(null);
  const regionUnitPrice = regionOverride ?? savedRegionUnitPrice;
  const personal = usePortalStore((s) => s.personalSales);
  const daily = usePortalStore((s) => s.dailySales);
  const finance = usePortalStore((s) => s.finance);
  const mappings = usePortalStore((s) => s.salesImportMappings);
  const setMapping = usePortalStore((s) => s.setSalesImportMapping);
  const applyDailySales = usePortalStore((s) => s.applyDailySales);
  const applyMonthlySales = usePortalStore((s) => s.applyMonthlySales);
  const collection = usePortalStore((s) => s.collection);

  const [sheet, setSheet] = useState<VisitCountSheet | null>(null);
  const [fileName, setFileName] = useState("");
  const [mode, setMode] = useState<Mode>("month");
  const [month, setMonthState] = useState(todayString().slice(0, 7));
  // 集計の最終日(今月分は「昨日まで」、過去の月は月末までを初期値にする)
  const defaultEnd = (m: string) => (m === todayString().slice(0, 7) ? (daysAgo(1).startsWith(m) ? daysAgo(1) : `${m}-01`) : monthEnd(m));
  const [periodEnd, setPeriodEnd] = useState(() => defaultEnd(todayString().slice(0, 7)));
  const setMonth = (m: string) => {
    setMonthState(m);
    setPeriodEnd(defaultEnd(m));
    setCommonDays(null);
  };
  // 稼働日数: 全員共通(初期値は営業日数)と、個人ごとの上書き
  const [commonDays, setCommonDays] = useState<number | null>(null);
  const [personDays, setPersonDays] = useState<Record<string, number | null>>({});
  const isPartial = periodEnd < monthEnd(month);
  const autoDays = businessDays(month, periodEnd);
  const baseDays = commonDays ?? autoDays;
  const daysFor = (rawName: string) => personDays[rawName] ?? baseDays;
  const [date, setDate] = useState(daysAgo(1));
  const [unitId, setUnitId] = useState<BusinessUnitId>("houkan");
  const [toFinance, setToFinance] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  // 氏名と職員の結びつけは、取り込むときに保存する
  const [localAliases, setLocalAliases] = useState<Record<string, string>>({});
  const aliases = { ...(mappings.iBow?.staffAliases ?? {}), ...localAliases };
  const estimate = useMemo(() => (sheet ? estimateSales(sheet, feeRates, regionUnitPrice) : null), [sheet, feeRates, regionUnitPrice]);
  const rows = (estimate?.staff ?? []).map((s) => ({ ...s, staffId: matchStaff(s.rawName, staff, aliases) }));
  const unmatched = rows.filter((r) => !r.staffId);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setMessage(null);
    try {
      const { readSheet } = await import("read-excel-file/browser");
      const data = await readSheet(file);
      setSheet(parseVisitCountSheet(data as unknown[][]));
      setFileName(file.name);
    } catch (err) {
      setSheet(null);
      setMessage(`⚠ 読み込めませんでした: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function setAlias(rawName: string, staffId: string) {
    setLocalAliases((a) => ({ ...a, [rawName]: staffId }));
  }

  function saveAliases() {
    if (!Object.keys(localAliases).length) return;
    const prev = mappings.iBow ?? { dateCol: "", staffCol: "", amountCol: "", visitsCol: "", unitPrice: 1, staffAliases: {} };
    setMapping("iBow", { ...prev, staffAliases: { ...prev.staffAliases, ...localAliases } });
    setLocalAliases({});
  }

  /** ファイルにいて職員マスタにいない人を、まとめて職員として追加する */
  function addUnmatchedAsStaff() {
    if (!confirm(`${unmatched.length}名を「${unitName(unitId)}」の職員として追加しますか?(職種・役職はあとで「設定・マスタ」で変更できます)`)) return;
    for (const r of unmatched) {
      collection("staff").add({
        id: newId("s"),
        name: r.rawName.normalize("NFKC").replace(/\s+/g, " ").trim(),
        unitId,
        role: "看護師",
        position: "一般スタッフ",
        isDriver: true,
        isSafetyManager: false,
        isEvaluator: false,
        active: true,
      });
    }
  }

  function doImport() {
    if (!estimate) return;
    saveAliases();
    const matched = rows.filter((r) => r.staffId);
    if (mode === "month") {
      // 月の個人売上・件数を置き換える(目標はそのまま/なければ前月を引き継ぐ)
      const next: PersonalSales[] = [...personal];
      for (const r of matched) {
        const i = next.findIndex((p) => p.staffId === r.staffId && p.month === month);
        const work = { workDays: daysFor(r.rawName) || null, periodEnd: isPartial ? periodEnd : "" };
        if (i >= 0) next[i] = { ...next[i], revenue: r.amount, visits: r.visits, ...work };
        else {
          const prevTarget =
            next.filter((p) => p.staffId === r.staffId && p.month < month && p.target !== null).sort((a, b) => b.month.localeCompare(a.month))[0]?.target ?? null;
          next.push({ id: newId("ps"), staffId: r.staffId, month, revenue: r.amount, target: prevTarget, visits: r.visits, ...work });
        }
      }
      let nextFinance;
      if (toFinance) {
        nextFinance = [...finance];
        const i = nextFinance.findIndex((f) => f.unitId === unitId && f.month === month);
        if (i >= 0) nextFinance[i] = { ...nextFinance[i], revenue: estimate.total };
        else nextFinance.push({ id: newId("fin"), unitId, month, revenue: estimate.total, revenueTarget: null, laborCost: null, otherCost: null, notes: "iBow訪問件数からの概算" });
      }
      applyMonthlySales(next, nextFinance);
      setMessage(
        `${month.replace("-", "年")}月${isPartial ? `(${Number(periodEnd.slice(8))}日まで)` : ""}の売上(概算 ${yen(estimate.total)})を ${matched.length}名分 取り込みました。個人の月の売上・1日あたりの売上に反映しました。${toFinance ? `${unitName(unitId)}の月の売上にも反映しました。` : ""}`
      );
    } else {
      const preview = {
        records: rows.map((r) => ({ date, staffId: r.staffId, rawName: r.rawName, amount: r.amount, visits: r.visits, source: "iBow" as const })),
        skipped: 0,
        rawNames: rows.map((r) => r.rawName),
        unmatchedNames: unmatched.map((r) => r.rawName),
        dates: [date],
        total: estimate.total,
      };
      const merged = mergeDailySales(daily, preview, "iBow");
      applyDailySales(merged, recomputePersonalSales(personal, merged, [date.slice(0, 7)]));
      setMessage(`${formatDate(date)} の売上(概算 ${yen(estimate.total)})を取り込みました。`);
    }
    setSheet(null);
    setFileName("");
    setPersonDays({});
    onImported?.(mode === "month" ? month : date.slice(0, 7));
  }

  return (
    <Card className="border-gold-300">
      <h2 className="text-sm font-bold text-slate-900">📊 iBow「訪問件数詳細表(職員別)」から売上を計算して取り込む</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        Excel(.xlsx)をそのまま選んでください。サービスごとの件数 × 報酬単価(「設定・マスタ」→「報酬単価」)で売上を概算します。加算・減算は含まない基本報酬ベースの金額です。
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className={`${buttonClass.primary} cursor-pointer`}>
          📄 Excelファイルを選ぶ
          <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={onFile} />
        </label>
        {fileName && <span className="text-xs text-slate-600">{fileName}</span>}
      </div>

      {sheet && estimate && (
        <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
            <Field label="ファイルの期間">
              <select className={inputClass} value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
                <option value="month">1か月分</option>
                <option value="day">1日分</option>
              </select>
            </Field>
            {mode === "month" ? (
              <>
                <Field label="対象の月">
                  <input type="month" className={inputClass} value={month} onChange={(e) => setMonth(e.target.value)} />
                </Field>
                <Field label="集計の最終日" hint="月の途中までのデータなら、その日">
                  <input
                    type="date"
                    className={inputClass}
                    min={`${month}-01`}
                    max={monthEnd(month)}
                    value={periodEnd}
                    onChange={(e) => {
                      setPeriodEnd(e.target.value || monthEnd(month));
                      setCommonDays(null);
                    }}
                  />
                </Field>
                <Field label="稼働日数(全員共通)" hint={`営業日(土日祝を除く)は ${autoDays}日`}>
                  <input type="number" min="1" max="31" className={inputClass} value={baseDays} onChange={(e) => setCommonDays(Number(e.target.value) || null)} />
                </Field>
              </>
            ) : (
              <Field label="対象の日">
                <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
            )}
            <Field label="事業所">
              <select className={inputClass} value={unitId} onChange={(e) => setUnitId(e.target.value as BusinessUnitId)}>
                {BUSINESS_UNITS.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="介護保険の1単位の円" hint="今回の計算のみ。保存は設定・マスタで">
              <input type="number" step="0.01" min="10" className={inputClass} value={regionUnitPrice} onChange={(e) => setRegionOverride(Number(e.target.value) || 10)} />
            </Field>
            {mode === "month" && (
              <label className="flex items-center gap-2 self-center text-xs text-slate-700">
                <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={toFinance} onChange={(e) => setToFinance(e.target.checked)} />
                事業所の月の売上にも反映
              </label>
            )}
          </div>

          {estimate.missingRates.length > 0 && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              単価が0円・未登録のため売上に含めていないもの: {estimate.missingRates.map((m) => `${m.group} ${m.code}(${m.count}件)`).join("、")}。「設定・マスタ」→「報酬単価」で入力できます。
            </p>
          )}
          <p className="text-[11px] text-slate-500">
            ※ 介護の [ ] は訪看Ⅰ5の請求回数、医療・精神の [ ] は基本療養費が発生しない回数(難病等複数回訪問等。今回 {estimate.excludedVisits} 回)として計算。{"{ }"} の副訪問(同行)は売上・件数に含めず「同行」欄に表示しています。
          </p>

          {unmatched.length > 0 && (
            <div className="rounded-lg bg-amber-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold text-amber-800">職員マスタにいない名前が {unmatched.length} 名あります。結びつけるか、まとめて職員として追加してください。</p>
                <button type="button" className={buttonClass.secondary} onClick={addUnmatchedAsStaff}>
                  ＋ {unmatched.length}名を職員として追加
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead className="text-xs text-slate-500">
                <tr className="text-right">
                  <th className="px-2 py-1.5 text-left font-semibold">ファイルの氏名</th>
                  <th className="px-2 py-1.5 text-left font-semibold">職員</th>
                  <th className="px-2 py-1.5 font-semibold">件数(主)</th>
                  <th className="px-2 py-1.5 font-semibold">同行(副)</th>
                  <th className="px-2 py-1.5 font-semibold">介護</th>
                  <th className="px-2 py-1.5 font-semibold">予防</th>
                  <th className="px-2 py-1.5 font-semibold">医療</th>
                  <th className="px-2 py-1.5 font-semibold">精神</th>
                  <th className="px-2 py-1.5 font-semibold">売上(概算)</th>
                  {mode === "month" && (
                    <>
                      <th className="px-2 py-1.5 font-semibold">稼働日数</th>
                      <th className="px-2 py-1.5 font-semibold">1日あたり売上</th>
                      <th className="px-2 py-1.5 font-semibold">1日あたり件数</th>
                      {isPartial && <th className="px-2 py-1.5 font-semibold">月末見込み</th>}
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-right">
                {rows.map((r) => (
                  <tr key={r.rawName} className={r.staffId ? "" : "bg-amber-50/50"}>
                    <td className="px-2 py-1.5 text-left">{r.rawName}</td>
                    <td className="px-2 py-1.5 text-left">
                      <select className={`${inputClass} w-40 py-1 text-xs`} value={r.staffId} onChange={(e) => setAlias(r.rawName, e.target.value)}>
                        <option value="">(未割当)</option>
                        {staff
                          .filter((s) => s.active)
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">{r.visits}</td>
                    <td className="px-2 py-1.5 text-slate-500">{r.subVisits || "-"}</td>
                    {["介護", "予防", "医療", "精神"].map((g) => (
                      <td key={g} className="px-2 py-1.5 font-mono text-xs">
                        {r.byGroup[g] ? yen(r.byGroup[g]) : "-"}
                      </td>
                    ))}
                    <td className="px-2 py-1.5 font-mono font-bold">{yen(r.amount)}</td>
                    {mode === "month" && (
                      <>
                        <td className="px-2 py-1">
                          <input
                            type="number"
                            min="1"
                            max="31"
                            className={`${inputClass} w-16 py-1 text-right text-xs`}
                            value={daysFor(r.rawName) || ""}
                            onChange={(e) => setPersonDays((d) => ({ ...d, [r.rawName]: e.target.value === "" ? null : Number(e.target.value) }))}
                            aria-label={`${r.rawName} 稼働日数`}
                          />
                        </td>
                        <td className="px-2 py-1.5 font-mono text-xs font-bold text-brand-700">{yen(perDay(r.amount, daysFor(r.rawName)))}</td>
                        <td className="px-2 py-1.5 text-xs">{perDay(r.visits, daysFor(r.rawName))?.toFixed(1) ?? "-"}</td>
                        {isPartial && <td className="px-2 py-1.5 font-mono text-xs">{yen(projectMonth(r.amount, daysFor(r.rawName), month))}</td>}
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 text-right font-bold">
                <tr>
                  <td className="px-2 py-2 text-left" colSpan={2}>
                    合計({rows.length}名)
                  </td>
                  <td className="px-2 py-2">{rows.reduce((s, r) => s + r.visits, 0)}</td>
                  <td className="px-2 py-2 text-slate-500">{rows.reduce((s, r) => s + r.subVisits, 0)}</td>
                  <td colSpan={4} />
                  <td className="px-2 py-2 font-mono">{yen(estimate.total)}</td>
                  {mode === "month" && <td colSpan={isPartial ? 4 : 3} />}
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={buttonClass.primary} onClick={doImport}>
              {mode === "month" ? `${month.replace("-", "年")}月の売上として取り込む` : `${formatDate(date)} の売上として取り込む`}
            </button>
            {unmatched.length > 0 && <span className="text-xs text-amber-700">未割当の{unmatched.length}名分は個人の売上には入りません。</span>}
          </div>
        </div>
      )}
      {message && <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${message.startsWith("⚠") ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>{message}</p>}
    </Card>
  );
}
