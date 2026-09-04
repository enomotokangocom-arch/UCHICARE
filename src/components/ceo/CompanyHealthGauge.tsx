import { CompanyHealthBreakdown } from "@/lib/ceo/types";

function colorForScore(score: number): string {
  if (score >= 75) return "#059669";
  if (score >= 50) return "#d97706";
  return "#e11d48";
}

export function CompanyHealthGauge({ breakdown }: { breakdown: CompanyHealthBreakdown }) {
  const color = colorForScore(breakdown.score);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium text-slate-500">会社状態スコア</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-4xl font-bold tabular-nums" style={{ color }}>
          {breakdown.score}
        </span>
        <span className="text-sm font-medium text-slate-400">/ 100</span>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full transition-all" style={{ width: `${breakdown.score}%`, backgroundColor: color }} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-slate-500">
        <div className="flex justify-between">
          <dt>売上達成度</dt>
          <dd className="font-semibold text-slate-700">{breakdown.revenueComponent}</dd>
        </div>
        <div className="flex justify-between">
          <dt>利益達成度</dt>
          <dd className="font-semibold text-slate-700">{breakdown.profitComponent}</dd>
        </div>
        <div className="flex justify-between">
          <dt>稼働率</dt>
          <dd className="font-semibold text-slate-700">{breakdown.utilizationComponent}</dd>
        </div>
        <div className="flex justify-between">
          <dt>課題の少なさ</dt>
          <dd className="font-semibold text-slate-700">{breakdown.severityComponent}</dd>
        </div>
      </dl>
    </div>
  );
}
