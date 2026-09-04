import { forecastBranchProfit, forecastBranchRevenue } from "@/lib/ceo/forecastEngine";
import { branchUtilization } from "@/lib/ceo/productivityEngine";
import { BranchMonthlyMetric } from "@/lib/ceo/types";
import { SeverityBadge } from "./SeverityBadge";

export function BranchTable({ metrics }: { metrics: BranchMonthlyMetric[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs text-slate-500">
            <th className="py-2 pr-4 font-medium">拠点</th>
            <th className="py-2 pr-4 font-medium">売上予測</th>
            <th className="py-2 pr-4 font-medium">計画比</th>
            <th className="py-2 pr-4 font-medium">利益予測</th>
            <th className="py-2 pr-4 font-medium">稼働率</th>
            <th className="py-2 pr-4 font-medium">利用者数</th>
            <th className="py-2 pr-4 font-medium">状態</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((m) => {
            const revenue = forecastBranchRevenue(m);
            const profit = forecastBranchProfit(m);
            const utilization = branchUtilization(m);
            const worstSeverity = [revenue.severity, profit.severity, utilization.severity].includes("red")
              ? "red"
              : [revenue.severity, profit.severity, utilization.severity].includes("yellow")
                ? "yellow"
                : "green";
            return (
              <tr key={m.branch} className="border-b border-slate-100 last:border-0">
                <td className="py-2.5 pr-4 font-semibold text-slate-800">{m.branch}</td>
                <td className="py-2.5 pr-4 tabular-nums text-slate-700">{revenue.forecastRevenue.toLocaleString()}円</td>
                <td className={`py-2.5 pr-4 font-semibold tabular-nums ${revenue.gapRatio < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                  {(revenue.gapRatio * 100).toFixed(1)}%
                </td>
                <td className="py-2.5 pr-4 tabular-nums text-slate-700">{profit.forecastProfit.toLocaleString()}円</td>
                <td className="py-2.5 pr-4 tabular-nums text-slate-700">{(utilization.utilizationRate * 100).toFixed(1)}%</td>
                <td className="py-2.5 pr-4 tabular-nums text-slate-700">{m.currentPatients.toLocaleString()}名</td>
                <td className="py-2.5 pr-4">
                  <SeverityBadge severity={worstSeverity} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
