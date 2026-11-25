"use client";

import { ChangeEvent, useState } from "react";
import { usePortalStore } from "@/lib/portal/store";
import { yen } from "@/lib/portal/logic";
import { unitName } from "@/lib/portal/defaults";
import { findHeaderRow, matchStaff, readCsvFile } from "@/lib/portal/salesImport";
import { StaffCost } from "@/lib/portal/types";
import { downloadCsv } from "@/lib/portal/util";
import { defaultStaffCost } from "@/lib/portal/profit";
import { Card, Field, buttonClass, inputClass } from "./ui";

export type SalaryEdit = Partial<Pick<StaffCost, "monthlySalary" | "fte" | "revenueGenerating">>;

const NAME_HINT = /氏名|名前|職員名|社員名|従業員名|スタッフ/;
/** 給与の列の候補(先にあるものほど優先。基本給より総支給を選ぶ) */
const SALARY_HINTS = [/総支給/, /支給合計/, /支給額/, /月の給与|月給/, /給与/, /基本給/];
const FTE_HINT = /常勤換算|換算/;
const EARN_HINT = /売上を上げる|売上対象/;

/** 「320,000円」「¥320000」などを数にする */
const toNumber = (v: string) => {
  const t = v.normalize("NFKC").replace(/[,¥円\s]/g, "");
  return t === "" || Number.isNaN(Number(t)) ? null : Number(t);
};
const guess = (headers: string[], re: RegExp | RegExp[]) => {
  for (const r of Array.isArray(re) ? re : [re]) {
    const h = headers.find((x) => r.test(x));
    if (h) return h;
  }
  return "";
};

/**
 * 職員の給与データ(給与ソフトの支給一覧・CSV/Excel)を読み込み、利益ラインの下書きに入れる。
 * ファイルはこのブラウザの中だけで読み取り、どこにも送らない(保存されるのは職員ごとの金額だけ)。
 */
export function SalaryImport({ onApply }: { onApply: (edits: Record<string, SalaryEdit>) => void }) {
  const staff = usePortalStore((s) => s.staff);
  const costs = usePortalStore((s) => s.staffCosts);
  const [rows, setRows] = useState<string[][] | null>(null);
  const [headerIndex, setHeaderIndex] = useState(0);
  const [cols, setCols] = useState({ name: "", salary: "", fte: "", earn: "" });
  const [aliases, setAliases] = useState<Record<string, string>>({});
  const [fileName, setFileName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const headers = rows?.[headerIndex] ?? [];

  function downloadTemplate() {
    const active = staff.filter((s) => s.active);
    downloadCsv(
      "給与データ_ひな形.csv",
      ["氏名", "事業所", "月の給与(総支給)", "常勤換算", "売上を上げる(1/0)"],
      active.map((s) => {
        const c = costs.find((x) => x.staffId === s.id);
        const def = defaultStaffCost(s);
        return [s.name, unitName(s.unitId), c?.monthlySalary ?? "", c?.fte ?? def.fte, (c?.revenueGenerating ?? def.revenueGenerating) ? 1 : 0];
      })
    );
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setMessage(null);
    try {
      let data: string[][];
      if (/\.xlsx$/i.test(file.name)) {
        const { readSheet } = await import("read-excel-file/browser");
        const sheet = (await readSheet(file)) as unknown[][];
        data = sheet.map((r) => r.map((c) => (c === null || c === undefined ? "" : String(c)))).filter((r) => r.some((c) => c.trim() !== ""));
      } else {
        data = await readCsvFile(file);
      }
      // 見出し行: 「氏名」などがある行。なければ文字の多い行
      const hi = data.slice(0, 15).findIndex((r) => r.some((c) => NAME_HINT.test(c)));
      const h = hi >= 0 ? hi : findHeaderRow(data);
      const hs = data[h] ?? [];
      setRows(data);
      setHeaderIndex(h);
      setCols({ name: guess(hs, NAME_HINT), salary: guess(hs, SALARY_HINTS), fte: guess(hs, FTE_HINT), earn: guess(hs, EARN_HINT) });
      setAliases({});
      setFileName(file.name);
    } catch (err) {
      setRows(null);
      setMessage(`⚠ 読み込めませんでした: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const preview = (() => {
    if (!rows || !cols.name || !cols.salary) return [];
    const ni = headers.indexOf(cols.name);
    const si = headers.indexOf(cols.salary);
    const fi = cols.fte ? headers.indexOf(cols.fte) : -1;
    const ei = cols.earn ? headers.indexOf(cols.earn) : -1;
    return rows
      .slice(headerIndex + 1)
      .map((r) => {
        const rawName = (r[ni] ?? "").trim();
        const salary = toNumber(r[si] ?? "");
        const fte = fi >= 0 ? toNumber(r[fi] ?? "") : null;
        const earnRaw = ei >= 0 ? (r[ei] ?? "").trim() : "";
        const earn = earnRaw === "" ? null : /^(1|○|〇|はい|true|yes)$/i.test(earnRaw);
        return { rawName, salary, fte, earn, staffId: aliases[rawName] ?? matchStaff(rawName, staff, {}) };
      })
      .filter((r) => r.rawName && !/合計|総計|小計/.test(r.rawName) && r.salary !== null);
  })();
  const matched = preview.filter((r) => r.staffId);
  const unmatched = preview.filter((r) => !r.staffId);

  function apply() {
    const edits: Record<string, SalaryEdit> = {};
    for (const r of matched) {
      edits[r.staffId] = {
        monthlySalary: r.salary,
        ...(r.fte !== null && r.fte > 0 && r.fte <= 1.5 ? { fte: r.fte } : {}),
        ...(r.earn !== null ? { revenueGenerating: r.earn } : {}),
      };
    }
    onApply(edits);
    setMessage(
      `${matched.length}名の給与を表に入れました。内容を確認して、下の「保存して利益ラインを計算し直す」を押すと保存されます。${unmatched.length ? `(職員に結びつかなかった${unmatched.length}名は入れていません)` : ""}`
    );
    setRows(null);
    setFileName("");
  }

  const colSelect = (key: keyof typeof cols, label: string, optional = false) => (
    <Field label={label}>
      <select className={inputClass} value={cols[key]} onChange={(e) => setCols({ ...cols, [key]: e.target.value })}>
        <option value="">{optional ? "(使わない)" : "(選んでください)"}</option>
        {headers.map((h, i) => (
          <option key={`${h}-${i}`} value={h}>
            {h || `(${i + 1}列目)`}
          </option>
        ))}
      </select>
    </Field>
  );

  return (
    <Card className="border-gold-300">
      <h2 className="text-sm font-bold text-slate-900">📤 給与データをアップロード</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        給与ソフトの支給一覧(Excel .xlsx または CSV)か、ひな形に入力したファイルを選んでください。氏名と月の給与(総支給)の列を選ぶと、職員ごとに表へ入ります。
        ファイルはこのブラウザの中だけで読み取り、保存されるのは職員ごとの金額だけです。
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className={`${buttonClass.primary} cursor-pointer`}>
          📄 ファイルを選ぶ
          <input type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={onFile} aria-label="給与データのファイル" />
        </label>
        <button type="button" className={buttonClass.secondary} onClick={downloadTemplate}>
          ⬇ ひな形をダウンロード(CSV)
        </button>
        {fileName && <span className="text-xs text-slate-600">{fileName}</span>}
      </div>

      {rows && (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Field label="見出しの行">
              <select className={inputClass} value={headerIndex} onChange={(e) => setHeaderIndex(Number(e.target.value))}>
                {rows.slice(0, 15).map((r, i) => (
                  <option key={i} value={i}>
                    {i + 1}行目: {r.filter(Boolean).slice(0, 3).join(" / ")}
                  </option>
                ))}
              </select>
            </Field>
            {colSelect("name", "氏名の列")}
            {colSelect("salary", "月の給与(総支給)の列")}
            {colSelect("fte", "常勤換算の列", true)}
            {colSelect("earn", "売上を上げる(1/0)の列", true)}
          </div>

          {preview.length === 0 ? (
            <p className="text-sm text-slate-500">氏名と給与の列を選ぶと、ここに読み取った内容が出ます。</p>
          ) : (
            <div className="max-h-80 overflow-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-2 py-1.5 text-left">ファイルの氏名</th>
                    <th className="px-2 py-1.5 text-left">職員</th>
                    <th className="px-2 py-1.5 text-right">月の給与</th>
                    <th className="px-2 py-1.5 text-right">常勤換算</th>
                    <th className="px-2 py-1.5 text-center">売上を上げる</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.map((r, i) => (
                    <tr key={`${r.rawName}-${i}`} className={r.staffId ? "" : "bg-amber-50"}>
                      <td className="px-2 py-1">{r.rawName}</td>
                      <td className="px-2 py-1">
                        <select
                          className={`${inputClass} w-40 py-1 text-xs`}
                          value={r.staffId}
                          onChange={(e) => setAliases((a) => ({ ...a, [r.rawName]: e.target.value }))}
                          aria-label={`${r.rawName} の職員`}
                        >
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
                      <td className="px-2 py-1 text-right font-mono">{yen(r.salary)}</td>
                      <td className="px-2 py-1 text-right">{r.fte ?? "-"}</td>
                      <td className="px-2 py-1 text-center">{r.earn === null ? "-" : r.earn ? "○" : "×"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={buttonClass.primary} disabled={matched.length === 0} onClick={apply}>
              {matched.length}名の給与を表に入れる
            </button>
            <button type="button" className={buttonClass.ghost} onClick={() => setRows(null)}>
              やめる
            </button>
            {unmatched.length > 0 && <span className="text-xs text-amber-700">未割当の{unmatched.length}名は入りません。職員を選んでください。</span>}
          </div>
        </div>
      )}
      {message && <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${message.startsWith("⚠") ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>{message}</p>}
    </Card>
  );
}
