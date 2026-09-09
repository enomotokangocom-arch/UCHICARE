"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";

export interface ActualImpact {
  metric: string;
  value: number;
  unit: string;
  note?: string;
}

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
  actualImpact?: ActualImpact | null;
}

const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-neutral-100 text-neutral-500",
  AI_RECOMMENDED: "bg-violet-50 text-violet-700",
  HUMAN_APPROVED: "bg-blue-50 text-blue-700",
  IN_PROGRESS: "bg-amber-50 text-amber-700",
  COMPLETED: "bg-emerald-50 text-emerald-700",
  RESULT_VERIFIED: "bg-emerald-100 text-emerald-800",
  HELD: "bg-neutral-100 text-neutral-500",
  REJECTED: "bg-red-50 text-red-700",
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "下書き",
  AI_RECOMMENDED: "AI提案",
  HUMAN_APPROVED: "承認済み",
  IN_PROGRESS: "着手中",
  COMPLETED: "完了",
  RESULT_VERIFIED: "実績確認済み",
  HELD: "保留中",
  REJECTED: "却下",
};

export function ActionRow({ action }: { action: ActionRowData }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function post(path: string, body?: unknown) {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/uchi-os/actions/${action.id}/${path}`, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) {
        const err = await response.json().catch(() => null);
        window.alert(err?.error?.message ?? "操作に失敗しました");
        return;
      }
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleReject() {
    const reason = window.prompt("却下理由(任意)") ?? undefined;
    post("reject", { reason });
  }

  function handleVerify() {
    const metric = window.prompt("測定した指標名(例: new_patients)");
    if (!metric) return;
    const valueStr = window.prompt("実績値(数値)");
    if (valueStr == null) return;
    const value = Number(valueStr);
    if (Number.isNaN(value)) {
      window.alert("数値を入力してください");
      return;
    }
    const unit = window.prompt("単位(例: 人、円、%)", "件") ?? "件";
    post("verify", { metric, value, unit });
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <span className={clsx("rounded px-1.5 py-0.5 text-[11px] font-medium", STATUS_STYLE[action.status])}>
          {STATUS_LABEL[action.status] ?? action.status}
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
      {action.holdReason && (action.status === "HELD" || action.status === "REJECTED") && (
        <p className="mt-1 text-xs text-neutral-400">
          {action.status === "HELD" ? "保留理由" : "却下理由"}: {action.holdReason}
        </p>
      )}
      {action.actualImpact && (
        <p className="mt-1 text-xs text-emerald-700">
          実績: {action.actualImpact.metric} = {action.actualImpact.value}
          {action.actualImpact.unit}
          {action.actualImpact.note ? `(${action.actualImpact.note})` : ""}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {(action.status === "AI_RECOMMENDED" || action.status === "HELD") && (
          <>
            <button
              onClick={() => post("approve")}
              disabled={isSubmitting}
              className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-40"
            >
              {action.status === "HELD" ? "承認へ戻す" : "承認"}
            </button>
            {action.status === "AI_RECOMMENDED" && (
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
            )}
            <button
              onClick={handleReject}
              disabled={isSubmitting}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-40"
            >
              却下
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
        {action.status === "COMPLETED" && (
          <button
            onClick={handleVerify}
            disabled={isSubmitting}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
          >
            実績を記録
          </button>
        )}
      </div>
    </div>
  );
}
