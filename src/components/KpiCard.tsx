import { ReactNode } from "react";
import clsx from "clsx";

export function KpiCard({
  title,
  value,
  unit,
  subtext,
  accentColor,
  badge,
}: {
  title: string;
  value: ReactNode;
  unit?: string;
  subtext?: string;
  accentColor?: string;
  badge?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500">{title}</p>
        {badge}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span
          className={clsx("text-3xl font-bold tabular-nums")}
          style={{ color: accentColor ?? "#0f172a" }}
        >
          {value}
        </span>
        {unit && <span className="text-sm font-medium text-slate-400">{unit}</span>}
      </div>
      {subtext && <p className="mt-1 text-xs text-slate-500">{subtext}</p>}
    </div>
  );
}
