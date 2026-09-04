import { Decision } from "@/lib/ceo/types";
import { SeverityBadge } from "./SeverityBadge";
import { APPROVAL_LEVEL_LABEL } from "@/lib/ceo/labels";

export function ExplainModal({ decision, onClose }: { decision: Decision; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">{decision.title}</h2>
            <p className="mt-0.5 text-xs text-slate-400">
              {decision.entityLabel} ・ {decision.decisionType} ・ 権限レベル {APPROVAL_LEVEL_LABEL[decision.requiredApprovalLevel]}
            </p>
          </div>
          <SeverityBadge severity={decision.severity} />
        </div>

        <section className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">使用したデータ</h3>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {decision.explain.dataUsed.map((d) => (
              <li key={d} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
                {d}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">計算式</h3>
          <p className="mt-1.5 rounded-lg bg-slate-50 p-3 font-mono text-[11px] leading-relaxed text-slate-700">
            {decision.explain.formula}
          </p>
        </section>

        <section className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">主要因の内訳</h3>
          <ul className="mt-1.5 space-y-1">
            {decision.explain.mainFactors.map((f) => (
              <li key={f.label} className="flex items-center justify-between text-sm">
                <span className="text-slate-600">{f.label}</span>
                <span className={`font-semibold tabular-nums ${f.contribution < 0 ? "text-rose-600" : "text-slate-800"}`}>
                  {f.contribution.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">代替案</h3>
          <ul className="mt-1.5 list-inside list-disc space-y-1 text-sm text-slate-600">
            {decision.explain.alternatives.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </section>

        <section className="mt-4 flex items-center justify-between rounded-lg bg-teal-50 px-3 py-2 text-xs text-teal-800">
          <span>信頼度(Confidence)</span>
          <span className="font-bold">{(decision.confidenceScore * 100).toFixed(0)}%</span>
        </section>

        <button
          onClick={onClose}
          className="mt-4 w-full rounded-lg border border-slate-300 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
