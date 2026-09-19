import clsx from "clsx";
import { LEAD_STATUS_LABELS, CANDIDATE_STAGE_LABELS, TRANSFER_TIMING_LABELS } from "@/lib/crm/constants";

const LEAD_STATUS_STYLES: Record<string, string> = {
  LEAD_COLD: "bg-slate-100 text-slate-600",
  LEAD_WARM: "bg-amber-100 text-amber-700",
  LEAD_HOT: "bg-rose-100 text-rose-700",
};

export function LeadStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
        LEAD_STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600"
      )}
    >
      {status === "LEAD_HOT" && "🔥 "}
      {LEAD_STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function StageBadge({ stage }: { stage: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-700">
      {CANDIDATE_STAGE_LABELS[stage] ?? stage}
    </span>
  );
}

export function TimingBadge({ timing }: { timing: string | null | undefined }) {
  if (!timing) return <span className="text-xs text-slate-400">未設定</span>;
  return <span className="text-xs text-slate-600">{TRANSFER_TIMING_LABELS[timing] ?? timing}</span>;
}
