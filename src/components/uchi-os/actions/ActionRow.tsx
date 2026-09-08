"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";

export interface ActionRowData {
  id: string;
  title: string;
  description: string;
  status: string;
  requiresApprovalCategory: string | null;
  deadline: string | null;
  stationName: string;
  ruleCode: string;
  holdReason: string | null;
}

const STATUS_STYLE: Record<string, string> = {
  AI_RECOMMENDED: "bg-violet-50 text-violet-700",
  HUMAN_APPROVED: "bg-blue-50 text-blue-700",
  IN_PROGRESS: "bg-amber-50 text-amber-700",
  COMPLETED: "bg-emerald-50 text-emerald-700",
  RESULT_VERIFIED: "bg-emerald-100 text-emerald-800",
  HELD: "bg-neutral-100 text-neutral-500",
  REJECTED: "bg-red-50 text-red-700",
};

export function ActionRow({ action }: { action: ActionRowData }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function post(path: string, body?: unknown) {
    setIsSubmitting(true);
    try {
      await fetch(`/api/uchi-os/actions/${action.id}/${path}`, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <span className={clsx("rounded px-1.5 py-0.5 text-[11px] font-medium", STATUS_STYLE[action.status])}>
          {action.status}
        </span>
        <span className="text-xs text-neutral-400">{action.ruleCode}</span>
        <span className="text-xs text-neutral-400">{action.stationName}</span>
        {action.requiresApprovalCategory && (
          <span className="rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700">
            要承認: {action.requiresApprovalCategory}
          </span>
        )}
      </div>
      <p className="mt-1.5 text-sm font-semibold text-neutral-900">{action.title}</p>
      <p className="mt-0.5 text-sm text-neutral-600">{action.description}</p>
      {action.holdReason && <p className="mt-1 text-xs text-neutral-400">保留理由: {action.holdReason}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        {action.status === "AI_RECOMMENDED" && (
          <>
            <button
              onClick={() => post("approve")}
              disabled={isSubmitting}
              className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-40"
            >
              承認
            </button>
            <button
              onClick={() => {
                const reason = window.prompt("保留理由を入力してください");
                if (reason) post("hold", { reason });
              }}
              disabled={isSubmitting}
              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
            >
              保留
            </button>
          </>
        )}
        {action.status === "HUMAN_APPROVED" && (
          <button
            onClick={() => post("status", { status: "IN_PROGRESS" })}
            disabled={isSubmitting}
            className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-40"
          >
            着手する
          </button>
        )}
        {action.status === "IN_PROGRESS" && (
          <button
            onClick={() => post("status", { status: "COMPLETED" })}
            disabled={isSubmitting}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
          >
            完了にする
          </button>
        )}
      </div>
    </div>
  );
}
