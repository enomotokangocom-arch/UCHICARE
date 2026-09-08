import clsx from "clsx";

export type DataSourceKind = "FACT" | "CALCULATED" | "AI_ESTIMATE";

const STYLES: Record<DataSourceKind, string> = {
  FACT: "bg-neutral-100 text-neutral-600",
  CALCULATED: "bg-blue-50 text-blue-700",
  AI_ESTIMATE: "bg-violet-50 text-violet-700",
};

const LABELS: Record<DataSourceKind, string> = {
  FACT: "FACT",
  CALCULATED: "CALCULATED",
  AI_ESTIMATE: "AI ESTIMATE",
};

/** 22章: FACT / CALCULATED / AI ESTIMATE を画面上で常に区別するための共通バッジ (12.5節)。 */
export function DataSourceBadge({ kind, confidence }: { kind: DataSourceKind; confidence?: number }) {
  return (
    <span
      className={clsx("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium", STYLES[kind])}
    >
      {LABELS[kind]}
      {kind === "AI_ESTIMATE" && confidence != null && <span>{Math.round(confidence * 100)}%</span>}
    </span>
  );
}
