"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { DataSourceBadge } from "@/components/uchi-os/DataSourceBadge";
import type { CeoMorningDecision } from "@/server/uchi-os/ceo-morning";

const PRIORITY_META: Record<string, { label: string; dot: string; border: string }> = {
  CRITICAL: { label: "CRITICAL", dot: "bg-red-500", border: "border-red-200" },
  HIGH: { label: "WARNING", dot: "bg-amber-500", border: "border-amber-200" },
  MEDIUM: { label: "INFO", dot: "bg-blue-500", border: "border-blue-200" },
  LOW: { label: "INFO", dot: "bg-blue-500", border: "border-blue-200" },
};

interface RootCauseFactor {
  label: string;
  kpiCode: string;
  value: number | null;
}

function formatYen(value: number) {
  return `${value >= 0 ? "+" : ""}${Math.round(value).toLocaleString("ja-JP")}円`;
}

export function TodayDecisionCard({ decision, onChanged }: { decision: CeoMorningDecision; onChanged: () => void }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const meta = PRIORITY_META[decision.priority] ?? PRIORITY_META.MEDIUM;
  const factors = ((decision.rootCause as { factors?: RootCauseFactor[] } | null)?.factors ?? []).filter(
    (f) => f.value != null,
  );
  const lowConfidence = decision.confidence < 0.5;

  async function callActionEndpoint(actionId: string, path: string, body?: unknown) {
    await fetch(`/api/uchi-os/actions/${actionId}/${path}`, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async function handleApproveAll() {
    setIsSubmitting(true);
    try {
      await Promise.all(decision.actions.map((a) => callActionEndpoint(a.id, "approve")));
      onChanged();
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleHoldAll() {
    const reason = window.prompt("保留理由を入力してください（例: 情報不足 / 様子見 / 優先度低）");
    if (!reason) return;
    setIsSubmitting(true);
    try {
      await Promise.all(decision.actions.map((a) => callActionEndpoint(a.id, "hold", { reason })));
      onChanged();
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleModifyFirst() {
    const first = decision.actions[0];
    if (!first) return;
    const newTitle = window.prompt("Actionの内容を修正してください", first.title);
    if (!newTitle || newTitle === first.title) return;
    setIsSubmitting(true);
    try {
      await callActionEndpoint(first.id, "modify", { title: newTitle });
      await Promise.all(decision.actions.map((a) => callActionEndpoint(a.id, "approve")));
      onChanged();
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleViewDetail() {
    if (decision.stationId) {
      router.push(`/uchi-os/dashboard/station/${decision.stationId}`);
    } else {
      router.push("/uchi-os/dashboard/financial");
    }
  }

  const allApproved = decision.actions.length > 0 && decision.actions.every((a) => a.status !== "AI_RECOMMENDED");

  return (
    <div className={clsx("rounded-2xl border bg-white p-5 shadow-sm", meta.border)}>
      <div className="flex items-center gap-2">
        <span className={clsx("h-2 w-2 rounded-full", meta.dot)} />
        <span className="text-xs font-semibold tracking-wide text-neutral-500">{meta.label}</span>
      </div>

      <p className="mt-2 text-base font-semibold leading-snug text-neutral-900">{decision.problemSummary}</p>

      {factors.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-neutral-500">主な原因</p>
          <ul className="mt-1 space-y-0.5 text-sm text-neutral-700">
            {factors.map((f, i) => (
              <li key={`${f.kpiCode}-${i}`} className="flex items-center gap-1.5">
                <span>・{f.label}</span>
                <DataSourceBadge kind="FACT" />
                <span className="text-neutral-500">
                  {f.value?.toLocaleString("ja-JP", { maximumFractionDigits: 1 })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {decision.predictedImpact != null && (
        <div className="mt-3 flex items-center gap-2">
          <p className="text-sm text-neutral-700">
            予測影響 <span className="font-semibold">{formatYen(decision.predictedImpact)}</span>
          </p>
          <DataSourceBadge kind="CALCULATED" />
        </div>
      )}

      {decision.actions.length > 0 && (
        <div className="mt-3">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-medium text-neutral-500">推奨Action</p>
            <DataSourceBadge kind="CALCULATED" confidence={decision.confidence} />
            {lowConfidence && <span className="text-[11px] font-medium text-amber-600">判断保留を推奨</span>}
          </div>
          <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-sm text-neutral-700">
            {decision.actions.map((a) => (
              <li key={a.id} className={clsx(a.status === "HUMAN_APPROVED" && "text-emerald-700")}>
                {a.title}
                {a.status === "HUMAN_APPROVED" && " ✓承認済"}
                {a.status === "HELD" && " （保留中）"}
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={handleApproveAll}
          disabled={isSubmitting || allApproved}
          className={clsx(
            "rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-40",
            lowConfidence ? "bg-neutral-100 text-neutral-500" : "bg-neutral-900 text-white hover:bg-neutral-700",
          )}
        >
          {allApproved ? "承認済み" : "承認"}
        </button>
        <button
          onClick={handleModifyFirst}
          disabled={isSubmitting || decision.actions.length === 0}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
        >
          修正
        </button>
        <button
          onClick={handleHoldAll}
          disabled={isSubmitting}
          className={clsx(
            "rounded-lg px-3 py-1.5 text-sm font-medium",
            lowConfidence
              ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
              : "border border-neutral-300 text-neutral-700 hover:bg-neutral-50",
          )}
        >
          保留
        </button>
        <button
          onClick={handleViewDetail}
          className="ml-auto text-sm font-medium text-neutral-500 hover:text-neutral-900"
        >
          詳細を見る →
        </button>
      </div>
    </div>
  );
}
