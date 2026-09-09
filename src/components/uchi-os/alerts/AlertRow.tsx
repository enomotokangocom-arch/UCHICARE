"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";

export interface AlertRowData {
  id: string;
  ruleCode: string;
  severity: string;
  title: string;
  stationName: string;
  status: string;
  detectedAt: string;
}

const SEVERITY_STYLE: Record<string, string> = {
  CRITICAL: "bg-red-50 text-red-700",
  WARNING: "bg-amber-50 text-amber-700",
  INFO: "bg-blue-50 text-blue-700",
};

const STATUS_LABEL: Record<string, string> = {
  OPEN: "未対応",
  ACKNOWLEDGED: "確認済み",
  RESOLVED: "解消",
  DISMISSED: "却下",
};

export function AlertRow({ alert }: { alert: AlertRowData }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function updateStatus(status: string) {
    setIsSubmitting(true);
    try {
      await fetch(`/api/uchi-os/alerts/${alert.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3">
      <div>
        <div className="flex items-center gap-2">
          <span className={clsx("rounded px-1.5 py-0.5 text-[11px] font-medium", SEVERITY_STYLE[alert.severity])}>
            {alert.severity}
          </span>
          <span className="text-xs text-neutral-400">{alert.ruleCode}</span>
          <span className="text-xs text-neutral-400">{alert.stationName}</span>
          <span className="text-xs text-neutral-400">{STATUS_LABEL[alert.status] ?? alert.status}</span>
        </div>
        <p className="mt-1 text-sm font-medium text-neutral-900">{alert.title}</p>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-neutral-400">{new Date(alert.detectedAt).toLocaleDateString("ja-JP")}</span>
        {alert.status === "OPEN" && (
          <button
            onClick={() => updateStatus("ACKNOWLEDGED")}
            disabled={isSubmitting}
            className="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
          >
            確認
          </button>
        )}
        {(alert.status === "OPEN" || alert.status === "ACKNOWLEDGED") && (
          <>
            <button
              onClick={() => updateStatus("RESOLVED")}
              disabled={isSubmitting}
              className="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
            >
              解消
            </button>
            <button
              onClick={() => updateStatus("DISMISSED")}
              disabled={isSubmitting}
              className="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
            >
              却下
            </button>
          </>
        )}
      </div>
    </div>
  );
}
