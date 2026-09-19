"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  status: string;
  createdAt: string;
  readAt: string | null;
  candidate: { id: string; name: string | null; lineDisplayName: string | null } | null;
}

const TYPE_LABELS: Record<string, string> = {
  CASUAL_REQUEST: "カジュアル面談希望",
  VISIT_REQUEST: "見学希望",
  APPLICATION: "応募",
  LINE_QUESTION: "LINE質問",
  HOT_TRANSITION: "HOT化",
  STALE_CANDIDATE: "長期未対応",
  REHEARING_DUE: "再ヒアリング",
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("unread");

  const load = useCallback(() => {
    return fetch(`/api/crm/notifications${filter === "unread" ? "?status=unread" : ""}`)
      .then((res) => res.json())
      .then((data) => setNotifications(data.notifications ?? []));
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function markRead(id: string) {
    await fetch(`/api/crm/notifications/${id}/read`, { method: "POST" });
    load();
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">通知</h1>
        <div className="flex gap-2 text-sm">
          <button
            onClick={() => setFilter("unread")}
            className={`rounded-md px-3 py-1 ${filter === "unread" ? "bg-teal-600 text-white" : "border border-slate-300"}`}
          >
            未読
          </button>
          <button
            onClick={() => setFilter("all")}
            className={`rounded-md px-3 py-1 ${filter === "all" ? "bg-teal-600 text-white" : "border border-slate-300"}`}
          >
            すべて
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {notifications.length === 0 && <p className="text-sm text-slate-400">通知はありません。</p>}
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`flex items-center justify-between rounded-xl border p-4 ${n.readAt ? "border-slate-100 bg-white" : "border-teal-200 bg-teal-50"}`}
          >
            <div>
              <p className="text-xs font-semibold text-teal-700">{TYPE_LABELS[n.type] ?? n.type}</p>
              <p className="text-sm font-medium text-slate-800">{n.title}</p>
              {n.body && <p className="text-xs text-slate-500">{n.body}</p>}
              {n.candidate && (
                <Link href={`/admin/candidates/${n.candidate.id}`} className="text-xs text-teal-700 hover:underline">
                  {n.candidate.name ?? n.candidate.lineDisplayName} を見る
                </Link>
              )}
              <p className="mt-1 text-[11px] text-slate-400">{new Date(n.createdAt).toLocaleString("ja-JP")}</p>
            </div>
            {!n.readAt && (
              <button
                onClick={() => markRead(n.id)}
                className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium hover:bg-slate-50"
              >
                既読にする
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
