import clsx from "clsx";
import { RiskLevel } from "@/lib/types";

const STYLES: Record<RiskLevel, string> = {
  low: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  medium: "bg-amber-50 text-amber-700 ring-amber-600/20",
  high: "bg-rose-50 text-rose-700 ring-rose-600/20",
};

const LABELS: Record<RiskLevel, string> = {
  low: "良好",
  medium: "要注意",
  high: "要改善",
};

export function RiskBadge({ level, label }: { level: RiskLevel; label?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        STYLES[level]
      )}
    >
      {label ?? LABELS[level]}
    </span>
  );
}
