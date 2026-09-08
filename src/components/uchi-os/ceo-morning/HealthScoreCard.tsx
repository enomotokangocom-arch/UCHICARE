import clsx from "clsx";
import type { HealthScoreWithTrend } from "@/server/uchi-os/health-score/compute";

export function HealthScoreCard({ healthScore }: { healthScore: HealthScoreWithTrend }) {
  const { overall, previousOverall, delta } = healthScore;

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Uchi OS SCORE</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-5xl font-semibold tracking-tight text-neutral-900">{overall ?? "—"}</span>
        <span className="text-lg text-neutral-400">/ 100</span>
      </div>
      {previousOverall != null && delta != null && (
        <p className="mt-1 text-sm text-neutral-500">
          前月 {previousOverall}
          <span className={clsx("ml-2 font-medium", delta >= 0 ? "text-emerald-600" : "text-red-600")}>
            {delta >= 0 ? "▲" : "▼"}
            {delta >= 0 ? "+" : ""}
            {delta} {delta >= 0 ? "改善" : "悪化"}
          </span>
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {healthScore.breakdown.map((item) => (
          <div
            key={item.key}
            className="flex min-w-[76px] flex-1 flex-col items-center rounded-lg bg-neutral-50 px-2 py-2 text-center"
          >
            <span className="text-[11px] text-neutral-500">{item.label}</span>
            <span className="text-sm font-semibold text-neutral-900">
              {item.score != null ? Math.round(item.score) : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
