"use client";

import { ChangeEvent, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { usePortalStore } from "@/lib/portal/store";
import { yen } from "@/lib/portal/logic";
import { unitName } from "@/lib/portal/defaults";
import { buildPreview, findHeaderRow, guessMapping, mergeDailySales, readCsvFile, recomputePersonalSales } from "@/lib/portal/salesImport";
import { BusinessUnitId, SalesImportMapping, SalesSource } from "@/lib/portal/types";
import { formatDate, formatDateTime, todayString } from "@/lib/portal/util";
import { Card, Field, StatusPill, UnitBadge, buttonClass, inputClass } from "./ui";
import Link from "next/link";

const SOURCES: SalesSource[] = ["ZEST", "iBow", "その他"];
const BAR = "#2f5b94";

/** 日次売上の取り込み(管理者)と日別の売上の表示 */
export function DailySalesTab({ canImport, units }: { canImport: boolean; units: BusinessUnitId[] }) {
  const staff = usePortalStore((s) => s.staff);
  const daily = usePortalStore((s) => s.dailySales);
  const personal = usePortalStore((s) => s.personalSales);
  const mappings = usePortalStore((s) => s.salesImportMappings);
  const setMapping = usePortalStore((s) => s.setSalesImportMapping);
  const applyDailySales = usePortalStore((s) => s.applyDailySales);

  const [source, setSource] = useState<SalesSource>("iBow");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<string[][] | null>(null);
  const [headerIndex, setHeaderIndex] = useState(0);
  const [mapping, setMappingState] = useState<SalesImportMapping | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [month, setMonth] = useState(todayString().slice(0, 7));

  const activeStaff = staff.filter((s) => s.active);
  const headers = rows?.[headerIndex] ?? [];
  const preview = useMemo(
    () => (rows && mapping ? buildPreview(rows, headerIndex, mapping, staff, source) : null),
    [rows, headerIndex, mapping, staff, source]
  );

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setMessage(null);
    try {
      const r = await readCsvFile(file);
      const h = findHeaderRow(r);
      setRows(r);
      setHeaderIndex(h);
      setFileName(file.name);
      setMappingState(guessMapping(r[h] ?? [], mappings[source]));
    } catch (err) {
      setMessage(`⚠ ファイルを読み込めませんでした: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function doImport() {
    if (!preview || !mapping) return;
    const merged = mergeDailySales(daily, preview, source);
    const months = [...new Set(preview.dates.map((d) => d.slice(0, 7)))];
    applyDailySales(merged, recomputePersonalSales(personal, merged, months));
    setMapping(source, mapping);
    setMessage(
      `${source} のデータを取り込みました(${formatDate(preview.dates[0])}〜${formatDate(preview.dates[preview.dates.length - 1])}・${yen(preview.total)})。個人の売上・訪問件数も更新しました。`
    );
    setRows(null);
    setFileName("");
  }

  const setCol = (key: keyof SalesImportMapping, value: string | number) => mapping && setMappingState({ ...mapping, [key]: value });

  // ---- 日別の表示 ----
  const unitStaff = new Set(staff.filter((s) => units.includes(s.unitId)).map((s) => s.id));
  const monthRows = daily.filter((d) => d.date.startsWith(month) && (d.staffId ? unitStaff.has(d.staffId) : units.length > 1));
  const byDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of monthRows) map.set(d.date, (map.get(d.date) ?? 0) + d.amount);
    const [y, m] = month.split("-").map(Number);
    const days = new Date(y, m, 0).getDate();
    return Array.from({ length: days }, (_, i) => {
      const date = `${month}-${String(i + 1).padStart(2, "0")}`;
      return { label: `${i + 1}`, date, amount: map.get(date) ?? 0 };
    });
  }, [monthRows, month]);
  const byStaff = useMemo(() => {
    const map = new Map<string, { amount: number; visits: number }>();
    for (const d of monthRows) {
      const k = d.staffId || `?${d.rawName}`;
      const t = map.get(k) ?? { amount: 0, visits: 0 };
      t.amount += d.amount;
      t.visits += d.visits;
      map.set(k, t);
    }
    return [...map.entries()].sort((a, b) => b[1].amount - a[1].amount);
  }, [monthRows]);
  const monthTotal = monthRows.reduce((s, d) => s + d.amount, 0);
  const lastImports = SOURCES.map((src) => {
    const list = daily.filter((d) => d.source === src);
    if (!list.length) return null;
    return { src, lastDate: list.map((d) => d.date).sort().at(-1)!, importedAt: list.map((d) => d.importedAt).sort().at(-1)! };
  }).filter((x): x is NonNullable<typeof x> => !!x);

  return (
    <div className="space-y-5">
      {canImport && (
        <Card className="border-gold-300">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-700">📊 iBow「訪問件数詳細表(職員別)」のExcelから個人の売上を計算する場合は「売上データ取り込み」へ</p>
            <Link href="/portal/sales-upload" className={buttonClass.secondary}>
              売上データ取り込みを開く
            </Link>
          </div>
        </Card>
      )}
      {canImport && (
        <Card className="border-brand-200">
          <h2 className="text-sm font-bold text-slate-900">📥 金額が入ったCSVを取り込む(ZEST・iBowの実績CSVなど)</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            ZEST・iBow から出力した実績のCSVを選ぶと、日別・職員別の売上に集計して取り込みます。同じ日付のデータは置き換わるので、同じ期間を何度取り込んでも二重にはなりません。
          </p>
          {lastImports.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {lastImports.map((l) => (
                <StatusPill key={l.src} tone={l.lastDate >= todayString().slice(0, 7) ? "ok" : "warn"}>
                  {l.src}: {formatDate(l.lastDate)} 分まで(取り込み {formatDateTime(l.importedAt)})
                </StatusPill>
              ))}
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <Field label="取り込み元">
              <select
                className={`${inputClass} w-auto`}
                value={source}
                onChange={(e) => {
                  const s = e.target.value as SalesSource;
                  setSource(s);
                  if (rows) setMappingState(guessMapping(rows[headerIndex] ?? [], mappings[s]));
                }}
              >
                {SOURCES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <label className={`${buttonClass.primary} cursor-pointer`}>
              📄 CSVファイルを選ぶ
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
            </label>
            {fileName && <span className="text-xs text-slate-600">{fileName}</span>}
          </div>

          {rows && mapping && (
            <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
                <Field label="見出しの行">
                  <select className={inputClass} value={headerIndex} onChange={(e) => setHeaderIndex(Number(e.target.value))}>
                    {rows.slice(0, 10).map((r, i) => (
                      <option key={i} value={i}>
                        {i + 1}行目: {r.filter(Boolean).slice(0, 3).join(" / ")}
                      </option>
                    ))}
                  </select>
                </Field>
                {(
                  [
                    ["dateCol", "日付の列"],
                    ["staffCol", "担当者の列"],
                    ["amountCol", "金額の列"],
                    ["visitsCol", "件数の列(任意)"],
                  ] as const
                ).map(([key, label]) => (
                  <Field key={key} label={label}>
                    <select className={inputClass} value={mapping[key]} onChange={(e) => setCol(key, e.target.value)}>
                      <option value="">{key === "visitsCol" ? "(1行=1件として数える)" : "(選んでください)"}</option>
                      {headers.filter(Boolean).map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </Field>
                ))}
                <Field label="1単位あたりの円" hint="金額の列が円なら 1">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className={inputClass}
                    value={mapping.unitPrice}
                    onChange={(e) => setCol("unitPrice", Number(e.target.value) || 1)}
                  />
                </Field>
              </div>

              {preview && preview.unmatchedNames.length > 0 && (
                <div className="rounded-lg bg-amber-50 p-3">
                  <p className="text-xs font-bold text-amber-800">職員と結びつかない担当者名があります。誰の売上か選んでください(次回からは自動で結びつきます)。</p>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {preview.unmatchedNames.map((name) => (
                      <label key={name} className="flex items-center gap-2 text-sm">
                        <span className="w-32 truncate font-semibold">{name}</span>
                        <select
                          className={`${inputClass} py-1`}
                          value={mapping.staffAliases[name] ?? ""}
                          onChange={(e) => setMappingState({ ...mapping, staffAliases: { ...mapping.staffAliases, [name]: e.target.value } })}
                        >
                          <option value="">(未割当のまま取り込む)</option>
                          {activeStaff.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}({unitName(s.unitId)})
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {preview && (
                <div className="flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 p-3 text-sm">
                  {preview.records.length === 0 ? (
                    <span className="text-rose-700">取り込める行がありません。日付と金額の列を確認してください。</span>
                  ) : (
                    <>
                      <span>
                        期間 <b>{formatDate(preview.dates[0])}〜{formatDate(preview.dates[preview.dates.length - 1])}</b>
                      </span>
                      <span>
                        合計 <b>{yen(preview.total)}</b>
                      </span>
                      <span>{preview.records.length}件(日付×職員)</span>
                      {preview.skipped > 0 && <span className="text-xs text-slate-500">合計行など {preview.skipped} 行は読み飛ばし</span>}
                      <button type="button" className={`${buttonClass.primary} ml-auto`} onClick={doImport}>
                        この内容で取り込む
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
          {message && (
            <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${message.startsWith("⚠") ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>{message}</p>
          )}
        </Card>
      )}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-900">
            日別の売上 {units.length === 1 && <UnitBadge unitId={units[0]} />}
          </h2>
          <input type="month" className={`${inputClass} w-auto`} value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
        {monthRows.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">この月の日次データはまだありません。{canImport ? "上からCSVを取り込んでください。" : ""}</p>
        ) : (
          <>
            <p className="mt-1 text-xs text-slate-500">
              月の合計 <b className="text-slate-800">{yen(monthTotal)}</b>
            </p>
            <div className="mt-2">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={byDay} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} interval={1} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} width={52} tickFormatter={(v) => `${Math.round(v / 10000)}万`} />
                  <Tooltip
                    formatter={(v) => [typeof v === "number" ? yen(v) : "-", "売上"]}
                    labelFormatter={(_, p) => (p?.[0]?.payload?.date ? formatDate(p[0].payload.date) : "")}
                    contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "#e2e8f0" }}
                  />
                  <Bar dataKey="amount" name="売上" fill={BAR} radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead className="text-xs text-slate-500">
                  <tr className="text-right">
                    <th className="px-2 py-1.5 text-left font-semibold">職員</th>
                    <th className="px-2 py-1.5 font-semibold">売上</th>
                    <th className="px-2 py-1.5 font-semibold">件数</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-right">
                  {byStaff.map(([k, t]) => (
                    <tr key={k}>
                      <td className="px-2 py-1.5 text-left">
                        {k.startsWith("?") ? <span className="text-amber-700">未割当: {k.slice(1) || "(担当者なし)"}</span> : staff.find((s) => s.id === k)?.name}
                      </td>
                      <td className="px-2 py-1.5 font-mono">{yen(t.amount)}</td>
                      <td className="px-2 py-1.5">{t.visits}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
