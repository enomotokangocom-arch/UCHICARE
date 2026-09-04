"use client";

import { useState } from "react";
import { datasetToSampleCsvFiles } from "@/lib/ceo/csv";
import { generateMockCeoDataset } from "@/lib/ceo/mockData";
import { useCeoStore } from "@/lib/ceo/store";

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function DataSourcePanel() {
  const dataset = useCeoStore((s) => s.dataset);
  const loadMockData = useCeoStore((s) => s.loadMockData);
  const loadFromCsv = useCeoStore((s) => s.loadFromCsv);
  const clearData = useCeoStore((s) => s.clearData);

  const [branchFile, setBranchFile] = useState<File | null>(null);
  const [nurseFile, setNurseFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleImport() {
    if (!branchFile || !nurseFile) {
      setError("拠点別月次データ・看護師別生産性データの両方のCSVを選択してください。");
      return;
    }
    const [branchText, nurseText] = await Promise.all([branchFile.text(), nurseFile.text()]);
    const result = loadFromCsv(branchText, nurseText);
    setError(result.ok ? null : (result.error ?? "取り込みに失敗しました。"));
  }

  function handleDownloadSample() {
    const sample = generateMockCeoDataset();
    datasetToSampleCsvFiles(sample).forEach((f) => downloadTextFile(f.filename, f.content));
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-800">データソース</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        {dataset
          ? `${dataset.source === "mock" ? "サンプルデータ" : "アップロードしたCSV"} ・ 読込 ${new Date(dataset.loadedAt).toLocaleString("ja-JP")}`
          : "データが読み込まれていません。"}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={loadMockData}
          className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700"
        >
          サンプルデータを読み込む
        </button>
        <button
          onClick={handleDownloadSample}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          サンプルCSVをダウンロード
        </button>
        {dataset && (
          <button
            onClick={clearData}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            クリア
          </button>
        )}
      </div>

      <div className="mt-4 border-t border-slate-100 pt-3">
        <p className="text-xs font-semibold text-slate-600">CSVをアップロードする</p>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            拠点別月次データ (monthly_branch_metrics.csv)
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setBranchFile(e.target.files?.[0] ?? null)}
              className="text-xs"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            看護師別生産性データ (nurse_productivity.csv)
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setNurseFile(e.target.files?.[0] ?? null)}
              className="text-xs"
            />
          </label>
        </div>
        <button
          onClick={handleImport}
          className="mt-2 rounded-lg border border-teal-300 px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50"
        >
          CSVを取り込む
        </button>
        {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
      </div>
    </div>
  );
}
