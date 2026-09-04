import clsx from "clsx";
import { Severity } from "@/lib/ceo/types";

const STYLES: Record<Severity, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  yellow: "bg-amber-50 text-amber-700 ring-amber-600/20",
  red: "bg-rose-50 text-rose-700 ring-rose-600/20",
};

const LABELS: Record<Severity, string> = {
  green: "順調",
  yellow: "注意",
  red: "要対応",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        STYLES[severity]
      )}
    >
      {LABELS[severity]}
    </span>
  );
}
