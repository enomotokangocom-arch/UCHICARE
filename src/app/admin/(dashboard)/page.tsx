"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LeadStatusBadge } from "@/components/crm/Badges";

interface ActionCandidate {
  id: string;
  name: string | null;
  lineDisplayName: string | null;
  leadStatus: string;
  leadScore: number;
  occupation: { name: string } | null;
  notificationId?: string;
}

interface TodayActionData {
  hot: ActionCandidate[];
  lineReplies: ActionCandidate[];
  casualRequests: ActionCandidate[];
  visitRequests: ActionCandidate[];
  stale: ActionCandidate[];
  rehearingDue: ActionCandidate[];
}

function Section({
  icon,
  title,
  candidates,
  emptyText,
}: {
  icon: string;
  title: string;
  candidates: ActionCandidate[];
  emptyText: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
        <span>{icon}</span>
        {title}
        <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{candidates.length}名</span>
      </h2>
      {candidates.length === 0 ? (
        <p className="text-sm text-slate-400">{emptyText}</p>
      ) : (
        <ul className="space-y-2">
          {candidates.slice(0, 8).map((c) => (
            <li key={c.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
              <Link href={`/admin/candidates/${c.id}`} className="text-sm font-medium text-teal-700 hover:underline">
                {c.name ?? c.lineDisplayName ?? "(未登録)"}
              </Link>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">{c.occupation?.name ?? "―"}</span>
                <LeadStatusBadge status={c.leadStatus} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function TodayActionPage() {
  const [data, setData] = useState<TodayActionData | null>(null);

  useEffect(() => {
    fetch("/api/crm/today-action")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) {
    return <div className="p-8 text-slate-500">読み込み中...</div>;
  }

  return (
    <div className="p-8">
      <h1 className="mb-1 text-xl font-bold text-slate-900">Today&apos;s Action</h1>
      <p className="mb-6 text-sm text-slate-500">今日対応した方がよい候補者を一覧表示します。</p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Section icon="🔥" title="HOT候補者" candidates={data.hot} emptyText="現在HOTの候補者はいません。" />
        <Section icon="💬" title="LINE返信あり(未対応)" candidates={data.lineReplies} emptyText="未対応の質問はありません。" />
        <Section icon="☕" title="カジュアル面談希望" candidates={data.casualRequests} emptyText="新規の希望はありません。" />
        <Section icon="🏠" title="見学希望" candidates={data.visitRequests} emptyText="新規の希望はありません。" />
        <Section icon="⏰" title="7日以上未対応" candidates={data.stale} emptyText="長期未対応の候補者はいません。" />
        <Section
          icon="🌱"
          title="転職時期 再確認対象"
          candidates={data.rehearingDue}
          emptyText="現在、再確認対象の候補者はいません。"
        />
      </div>
    </div>
  );
}
