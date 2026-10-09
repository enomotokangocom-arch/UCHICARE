import { forecastCareManagementRevenue } from "@/lib/ceo/careManagementEngine";
import { forecastDayServiceRevenue } from "@/lib/ceo/dayServiceEngine";
import { CareManagementMonthlyMetric, DayServiceMonthlyMetric } from "@/lib/ceo/types";
import { SeverityBadge } from "./SeverityBadge";

function worstOf(...severities: ("green" | "yellow" | "red")[]): "green" | "yellow" | "red" {
  if (severities.includes("red")) return "red";
  if (severities.includes("yellow")) return "yellow";
  return "green";
}

/** 居宅介護支援(ケース数ベース)・通所介護(キャパシティベース)など、訪問看護とは
 * 収益モデルが異なる事業ラインをまとめて表示する汎用テーブル。 */
export function BusinessLineTable({
  careManagement,
  dayService,
}: {
  careManagement: CareManagementMonthlyMetric[];
  dayService: DayServiceMonthlyMetric[];
}) {
  const rows = [
    ...careManagement.map((m) => {
      const f = forecastCareManagementRevenue(m);
      return {
        key: `cm-${m.office}`,
        label: m.office,
        forecastRevenue: f.forecastRevenue,
        gapRatio: f.gapRatio,
        kpiLabel: "ケースロード",
        kpiValue: `${f.caseloadPerFte}件/人(目安${m.targetCaseloadPerFte}件)`,
        severity: worstOf(f.severity, f.caseloadSeverity),
      };
    }),
    ...dayService.map((m) => {
      const f = forecastDayServiceRevenue(m);
      return {
        key: `ds-${m.office}`,
        label: m.office,
        forecastRevenue: f.forecastRevenue,
        gapRatio: f.gapRatio,
        kpiLabel: "稼働率",
        kpiValue: `${(f.utilizationRate * 100).toFixed(1)}%`,
        severity: worstOf(f.severity, f.utilizationSeverity),
      };
    }),
  ];

  if (rows.length === 0) {
    return <p className="text-sm text-slate-400">データがありません。</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs text-slate-500">
            <th className="py-2 pr-4 font-medium">事業所</th>
            <th className="py-2 pr-4 font-medium">売上予測</th>
            <th className="py-2 pr-4 font-medium">計画比</th>
            <th className="py-2 pr-4 font-medium">主要KPI</th>
            <th className="py-2 pr-4 font-medium">状態</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-slate-100 last:border-0">
              <td className="py-2.5 pr-4 font-semibold text-slate-800">{r.label}</td>
              <td className="py-2.5 pr-4 tabular-nums text-slate-700">{r.forecastRevenue.toLocaleString()}円</td>
              <td className={`py-2.5 pr-4 font-semibold tabular-nums ${r.gapRatio < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                {(r.gapRatio * 100).toFixed(1)}%
              </td>
              <td className="py-2.5 pr-4 text-slate-700">
                {r.kpiLabel}: {r.kpiValue}
              </td>
              <td className="py-2.5 pr-4">
                <SeverityBadge severity={r.severity} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
