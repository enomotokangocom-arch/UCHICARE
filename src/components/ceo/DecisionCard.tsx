import { Decision } from "@/lib/ceo/types";
import { SeverityBadge } from "./SeverityBadge";

function formatValue(value: number, unit: string): string {
  if (unit === "円") return `${Math.round(value).toLocaleString()}円`;
  if (unit === "%") return `${value.toFixed(1)}%`;
  if (unit === "FTE") return `${value.toFixed(2)}FTE`;
  return `${value.toLocaleString()}${unit}`;
}

export function DecisionCard({
  decision,
  onApprove,
  onReject,
  onModify,
  onShowDetail,
}: {
  decision: Decision;
  onApprove: () => void;
  onReject: () => void;
  onModify: () => void;
  onShowDetail: () => void;
}) {
  const statusLabel: Record<Decision["approvalStatus"], string> = {
    pending: "未対応",
    approved: "承認済み",
    rejected: "却下済み",
    modified: "条件変更済み",
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">{decision.title}</h3>
          <p className="mt-0.5 text-xs text-slate-400">
            {decision.entityLabel} ・ 信頼度 {(decision.confidenceScore * 100).toFixed(0)}%
            {decision.aiNarrative === "fallback" && " ・ テンプレート説明"}
          </p>
        </div>
        <SeverityBadge severity={decision.severity} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs sm:grid-cols-3">
        <div>
          <p className="text-slate-400">現状</p>
          <p className="font-semibold text-slate-800">{formatValue(decision.currentValue, decision.unit)}</p>
        </div>
        <div>
          <p className="text-slate-400">計画</p>
          <p className="font-semibold text-slate-800">{formatValue(decision.targetValue, decision.unit)}</p>
        </div>
        <div>
          <p className="text-slate-400">Gap</p>
          <p className={`font-semibold ${decision.gap < 0 ? "text-rose-600" : "text-emerald-600"}`}>
            {decision.gap > 0 ? "+" : ""}
            {formatValue(decision.gap, decision.unit)}
          </p>
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-slate-600">{decision.reasoningSummary}</p>

      <div className="mt-2 rounded-lg bg-teal-50 px-3 py-2">
        <p className="text-xs font-semibold text-teal-800">AI推奨</p>
        <p className="mt-0.5 text-sm text-teal-900">{decision.recommendedAction}</p>
        <p className="mt-1 text-xs text-teal-700">期待効果: {decision.expectedImpact}</p>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {decision.approvalStatus === "pending" ? (
            <>
              <button
                onClick={onApprove}
                className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700"
              >
                承認
              </button>
              <button
                onClick={onReject}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                却下
              </button>
              <button
                onClick={onModify}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                条件変更
              </button>
            </>
          ) : (
            <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">
              {statusLabel[decision.approvalStatus]}
              {decision.approvedBy ? `(${decision.approvedBy})` : ""}
            </span>
          )}
        </div>
        <button onClick={onShowDetail} className="text-xs font-semibold text-teal-700 hover:underline">
          詳細を見る →
        </button>
      </div>
    </div>
  );
}
