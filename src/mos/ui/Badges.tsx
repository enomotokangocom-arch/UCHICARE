import type { ValueStatus } from "../domain/types";

const STATUS: Record<ValueStatus, { label: string; cls: string; icon: string }> = {
  ESTIMATED: { label: "推計", cls: "bg-amber-50 text-amber-800 ring-amber-300", icon: "△" },
  RECONCILED: { label: "照合済", cls: "bg-sky-50 text-sky-800 ring-sky-300", icon: "◎" },
  FINAL: { label: "確定", cls: "bg-emerald-50 text-emerald-800 ring-emerald-300", icon: "✓" },
};

export function StatusBadge({ status, title }: { status: ValueStatus; title?: string }) {
  const s = STATUS[status];
  return (
    <span title={title} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${s.cls}`}>
      <span aria-hidden>{s.icon}</span>
      {s.label}
    </span>
  );
}

const IMPORT: Record<string, string> = {
  PROCESSING: "bg-slate-100 text-slate-700",
  SUCCEEDED: "bg-emerald-50 text-emerald-800",
  PARTIAL: "bg-amber-50 text-amber-800",
  FAILED: "bg-red-50 text-red-800",
  DUPLICATE: "bg-slate-100 text-slate-600",
};
export const IMPORT_STATUS_LABEL: Record<string, string> = {
  PROCESSING: "処理中",
  SUCCEEDED: "成功",
  PARTIAL: "一部エラー",
  FAILED: "失敗",
  DUPLICATE: "重複（取込済）",
};
export function ImportStatusBadge({ status }: { status: string }) {
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${IMPORT[status] ?? ""}`}>{IMPORT_STATUS_LABEL[status] ?? status}</span>;
}

export function SampleBanner({ origin }: { origin: "REAL" | "SAMPLE" }) {
  if (origin !== "SAMPLE") return null;
  return (
    <div role="alert" className="mb-4 rounded-lg border-2 border-dashed border-violet-400 bg-violet-50 px-4 py-3 text-sm text-violet-900">
      <strong>サンプルデータを表示中です。</strong> 実在しない架空の数値です。経営判断には使用しないでください。
      <a href="?" className="ml-2 underline">実データに切り替える</a>
    </div>
  );
}
