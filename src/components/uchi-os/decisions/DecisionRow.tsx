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

interface ExplanationState {
  status: "idle" | "loading" | "available" | "unavailable";
  text?: string;
  confidence?: number | null;
  reason?: string;
}

export function DecisionRow({ decision }: { decision: DecisionRowData }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [explanation, setExplanation] = useState<ExplanationState>({ status: "idle" });
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

  async function handleShowExplanation() {
    setExplanation({ status: "loading" });
    try {
      const response = await fetch(`/api/uchi-os/decisions/${decision.id}/explanation`);
      const body = await response.json();
      if (body.available) {
        setExplanation({ status: "available", text: body.outputText, confidence: body.confidence });
      } else {
        setExplanation({ status: "unavailable", reason: body.reason });
      }
    } catch {
      setExplanation({ status: "unavailable", reason: "通信エラーが発生しました" });
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

      {explanation.status === "available" && (
        <div className="mt-2 rounded-lg bg-violet-50 p-3">
          <div className="mb-1 flex items-center gap-1.5">
            <DataSourceBadge kind="AI_ESTIMATE" confidence={explanation.confidence ?? undefined} />
            <span className="text-[11px] text-violet-700">AIによる原因説明</span>
          </div>
          <p className="text-sm text-violet-900">{explanation.text}</p>
        </div>
      )}
      {explanation.status === "unavailable" && (
        <p className="mt-2 text-xs text-neutral-400">AI分析は利用できません({explanation.reason})</p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <DataSourceBadge kind="CALCULATED" confidence={decision.confidence} />
        <span className="text-xs text-neutral-400">Actions: {decision.actionCount}</span>
        {explanation.status === "idle" && (
          <button
            onClick={handleShowExplanation}
            className="text-xs font-medium text-violet-700 hover:text-violet-900"
          >
            AI分析を見る
          </button>
        )}
        {explanation.status === "loading" && <span className="text-xs text-neutral-400">分析中...</span>}
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
