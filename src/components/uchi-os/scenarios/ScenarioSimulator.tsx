"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DataSourceBadge } from "@/components/uchi-os/DataSourceBadge";

interface Station {
  id: string;
  name: string;
}

type ScenarioType =
  | "HIRE_NURSE"
  | "RESIGNATION"
  | "PATIENT_INCREASE"
  | "PATIENT_DECREASE"
  | "PRICE_CHANGE"
  | "NEW_STATION"
  | "SALARY_INCREASE"
  | "INCENTIVE_CHANGE";

const SCENARIO_TYPES: { value: ScenarioType; label: string; fields: { key: string; label: string; unit: string }[] }[] = [
  { value: "HIRE_NURSE", label: "看護師採用", fields: [{ key: "count", label: "採用人数", unit: "人" }] },
  { value: "RESIGNATION", label: "退職", fields: [{ key: "count", label: "退職人数", unit: "人" }] },
  { value: "PATIENT_INCREASE", label: "利用者増加", fields: [{ key: "count", label: "増加人数", unit: "人" }] },
  { value: "PATIENT_DECREASE", label: "利用者減少", fields: [{ key: "count", label: "減少人数", unit: "人" }] },
  { value: "PRICE_CHANGE", label: "単価変更", fields: [{ key: "pctChange", label: "変更率", unit: "%" }] },
  {
    value: "NEW_STATION",
    label: "新規出店",
    fields: [
      { key: "estimatedMonthlyRevenue", label: "想定月間売上", unit: "円" },
      { key: "estimatedMonthlyLaborCost", label: "想定月間人件費", unit: "円" },
    ],
  },
  { value: "SALARY_INCREASE", label: "給与アップ", fields: [{ key: "pctChange", label: "昇給率", unit: "%" }] },
  { value: "INCENTIVE_CHANGE", label: "インセンティブ変更", fields: [{ key: "monthlyAmount", label: "月額", unit: "円" }] },
];

interface ScenarioProjection {
  revenue: number | null;
  laborCost: number | null;
  operatingProfit: number | null;
  operatingProfitMargin: number | null;
  utilizationRate: number | null;
  patientCount: number | null;
  nurseCount: number | null;
}

interface ScenarioRecord {
  id: string;
  name: string;
  inputParams: { stationId: string | null; type: ScenarioType; params: Record<string, number> };
  resultSummary: { baseline: ScenarioProjection; withScenario: ScenarioProjection; delta: ScenarioProjection } | null;
  createdAt: string;
}

function fmt(value: number | null, unit: "yen" | "pt" | "num" = "yen") {
  if (value == null) return "—";
  if (unit === "yen") return `${value >= 0 ? "+" : ""}${Math.round(value).toLocaleString("ja-JP")}円`;
  if (unit === "pt") return `${value >= 0 ? "+" : ""}${value.toFixed(1)}pt`;
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
}

export function ScenarioSimulator({ stations, history }: { stations: Station[]; history: ScenarioRecord[] }) {
  const router = useRouter();
  const [stationId, setStationId] = useState<string>("");
  const [type, setType] = useState<ScenarioType>("HIRE_NURSE");
  const [paramValues, setParamValues] = useState<Record<string, string>>({ count: "1" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<ScenarioRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentType = SCENARIO_TYPES.find((t) => t.value === type)!;

  function handleTypeChange(next: ScenarioType) {
    setType(next);
    const nextType = SCENARIO_TYPES.find((t) => t.value === next)!;
    setParamValues(Object.fromEntries(nextType.fields.map((f) => [f.key, "0"])));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const params = Object.fromEntries(currentType.fields.map((f) => [f.key, Number(paramValues[f.key] ?? 0)]));
      const response = await fetch("/api/uchi-os/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${stations.find((s) => s.id === stationId)?.name ?? "法人全体"} / ${currentType.label}`,
          stationId: stationId || null,
          type,
          params,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body?.error?.message ?? "シミュレーションに失敗しました");
        return;
      }
      setResult(body.scenario);
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="rounded-2xl border border-neutral-200 bg-white p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500">対象</label>
            <select
              value={stationId}
              onChange={(e) => setStationId(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
            >
              <option value="">法人全体</option>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500">シナリオ種別</label>
            <select
              value={type}
              onChange={(e) => handleTypeChange(e.target.value as ScenarioType)}
              className="w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
            >
              {SCENARIO_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          {currentType.fields.map((f) => (
            <div key={f.key}>
              <label className="mb-1 block text-xs font-medium text-neutral-500">
                {f.label} ({f.unit})
              </label>
              <input
                type="number"
                value={paramValues[f.key] ?? ""}
                onChange={(e) => setParamValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                className="w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
              />
            </div>
          ))}
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-4 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-40"
        >
          {isSubmitting ? "計算中..." : "シミュレーション実行"}
        </button>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </form>

      {result?.resultSummary && (
        <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-5">
          <div className="mb-2 flex items-center gap-2">
            <p className="text-sm font-semibold text-neutral-700">{result.name} — 3ヶ月後の影響</p>
            <DataSourceBadge kind="CALCULATED" />
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                <th className="py-1.5 font-medium">指標</th>
                <th className="py-1.5 font-medium">現状トレンド(何もしない場合)</th>
                <th className="py-1.5 font-medium">シナリオ適用後</th>
                <th className="py-1.5 font-medium">差分</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-neutral-100">
                <td className="py-1.5">売上</td>
                <td className="py-1.5">{fmt(result.resultSummary.baseline.revenue).replace("+", "")}</td>
                <td className="py-1.5 font-medium">{fmt(result.resultSummary.withScenario.revenue).replace("+", "")}</td>
                <td className="py-1.5">{fmt(result.resultSummary.delta.revenue)}</td>
              </tr>
              <tr className="border-b border-neutral-100">
                <td className="py-1.5">人件費</td>
                <td className="py-1.5">{fmt(result.resultSummary.baseline.laborCost).replace("+", "")}</td>
                <td className="py-1.5 font-medium">{fmt(result.resultSummary.withScenario.laborCost).replace("+", "")}</td>
                <td className="py-1.5">{fmt(result.resultSummary.delta.laborCost)}</td>
              </tr>
              <tr className="border-b border-neutral-100">
                <td className="py-1.5">営業利益</td>
                <td className="py-1.5">{fmt(result.resultSummary.baseline.operatingProfit).replace("+", "")}</td>
                <td className="py-1.5 font-medium">{fmt(result.resultSummary.withScenario.operatingProfit).replace("+", "")}</td>
                <td className="py-1.5">{fmt(result.resultSummary.delta.operatingProfit)}</td>
              </tr>
              <tr className="border-b border-neutral-100">
                <td className="py-1.5">稼働率</td>
                <td className="py-1.5">{fmt(result.resultSummary.baseline.utilizationRate, "num").replace("+", "")}%</td>
                <td className="py-1.5 font-medium">{fmt(result.resultSummary.withScenario.utilizationRate, "num").replace("+", "")}%</td>
                <td className="py-1.5">{fmt(result.resultSummary.delta.utilizationRate, "pt")}</td>
              </tr>
              <tr>
                <td className="py-1.5">利用者数 / 看護師数</td>
                <td className="py-1.5">
                  {fmt(result.resultSummary.baseline.patientCount, "num").replace("+", "")}人 /{" "}
                  {fmt(result.resultSummary.baseline.nurseCount, "num").replace("+", "")}人
                </td>
                <td className="py-1.5 font-medium">
                  {fmt(result.resultSummary.withScenario.patientCount, "num").replace("+", "")}人 /{" "}
                  {fmt(result.resultSummary.withScenario.nurseCount, "num").replace("+", "")}人
                </td>
                <td className="py-1.5">
                  {fmt(result.resultSummary.delta.patientCount, "num")}人 / {fmt(result.resultSummary.delta.nurseCount, "num")}人
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-sm font-semibold text-neutral-700">過去のシミュレーション</p>
          <div className="space-y-2">
            {history.map((h) => (
              <div key={h.id} className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm">
                <span className="font-medium text-neutral-900">{h.name}</span>
                <span className="ml-2 text-xs text-neutral-400">{new Date(h.createdAt).toLocaleString("ja-JP")}</span>
                {h.resultSummary && (
                  <span className="ml-2 text-xs text-neutral-500">
                    営業利益差分: {fmt(h.resultSummary.delta.operatingProfit)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
