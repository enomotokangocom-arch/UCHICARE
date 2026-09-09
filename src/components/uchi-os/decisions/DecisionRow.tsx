"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { DataSourceBadge } from "@/components/uchi-os/DataSourceBadge";

interface RootCauseFactor {
  label: string;
  value: number | null;
}

export interface DecisionRowData {
  id: string;
  ruleCode: string;
  priority: string;
  status: string;
  stationName: string;
  problemSummary: string;
  rootCause: { factors?: RootCauseFactor[] } | null;
  confidence: number;
  actionCount: number;
  alertStatus: string | null;
}

const PRIORITY_STYLE: Record<string, string> = {
  CRITICAL: "bg-red-50 text-red-700",
  HIGH: "bg-amber-50 text-amber-700",
  MEDIUM: "bg-blue-50 text-blue-700",
  LOW: "bg-neutral-100 text-neutral-600",
};

export function DecisionRow({ decision }: { decision: DecisionRowData }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const factors = (decision.rootCause?.factors ?? []).filter((f) => f.value != null);
  const alertInactive = decision.alertStatus === "RESOLVED" || decision.alertStatus === "DISMISSED";

  async function handleDismiss() {
    setIsSubmitting(true);
    try {
      await fetch(`/api/uchi-os/decisions/${decision.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DISMISSED" }),
      });
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <div className="flex items-center gap-2">
        <span className={clsx("rounded px-1.5 py-0.5 text-[11px] font-medium", PRIORITY_STYLE[decision.priority])}>
          {decision.priority}
        </span>
        <span className="text-xs text-neutral-400">{decision.ruleCode}</span>
        <span className="text-xs text-neutral-400">{decision.stationName}</span>
        {alertInactive && <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] text-neutral-500">Alert解消済み</span>}
        <span className="ml-auto text-xs text-neutral-400">{decision.status}</span>
      </div>
      <p className="mt-2 text-sm font-semibold text-neutral-900">{decision.problemSummary}</p>
      {factors.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2 text-xs text-neutral-600">
          {factors.map((f, i) => (
            <li key={i} className="rounded bg-neutral-50 px-2 py-1">
              {f.label}: {f.value?.toLocaleString("ja-JP")}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex items-center gap-2">
        <DataSourceBadge kind="CALCULATED" confidence={decision.confidence} />
        <span className="text-xs text-neutral-400">Actions: {decision.actionCount}</span>
        {decision.status !== "DISMISSED" && (
          <button
            onClick={handleDismiss}
            disabled={isSubmitting}
            className="ml-auto text-xs font-medium text-neutral-400 hover:text-neutral-900 disabled:opacity-40"
          >
            却下する
          </button>
        )}
      </div>
    </div>
  );
}
