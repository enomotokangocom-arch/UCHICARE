"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { CANDIDATE_STAGE_ORDER, CANDIDATE_STAGE_LABELS, OCCUPATION_LABELS } from "@/lib/crm/constants";
import { LeadStatusBadge } from "@/components/crm/Badges";

interface KanbanCandidate {
  id: string;
  name: string | null;
  lineDisplayName: string | null;
  stage: string;
  leadStatus: string;
  leadScore: number;
  occupation: { code: string; name: string } | null;
  assignedStaff: { name: string } | null;
}

type Grouped = Record<string, KanbanCandidate[]>;

export default function KanbanPage() {
  const [grouped, setGrouped] = useState<Grouped>({});
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const load = useCallback(() => {
    return Promise.resolve()
      .then(() => setLoading(true))
      .then(() => fetch("/api/crm/candidates/kanban"))
      .then((res) => res.json())
      .then((data) => {
        setGrouped(data.grouped ?? {});
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function moveCandidate(id: string, toStage: string) {
    // 楽観的UI更新
    setGrouped((prev) => {
      const next: Grouped = {};
      for (const [stage, list] of Object.entries(prev)) {
        next[stage] = list.filter((c) => c.id !== id);
      }
      const moved = Object.values(prev).flat().find((c) => c.id === id);
      if (moved) {
        next[toStage] = [{ ...moved, stage: toStage }, ...(next[toStage] ?? [])];
      }
      return next;
    });

    await fetch(`/api/crm/candidates/${id}/stage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: toStage }),
    });
  }

  if (loading) {
    return <div className="p-8 text-slate-500">読み込み中...</div>;
  }

  return (
    <div className="p-8">
      <h1 className="mb-6 text-xl font-bold text-slate-900">選考カンバン</h1>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {CANDIDATE_STAGE_ORDER.map((stage) => (
          <div
            key={stage}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (draggingId) moveCandidate(draggingId, stage);
            }}
            className="flex w-64 shrink-0 flex-col rounded-xl border border-slate-200 bg-slate-50"
          >
            <div className="border-b border-slate-200 px-3 py-2">
              <p className="text-sm font-bold text-slate-700">{CANDIDATE_STAGE_LABELS[stage]}</p>
              <p className="text-xs text-slate-400">{grouped[stage]?.length ?? 0}件</p>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-2" style={{ minHeight: 200, maxHeight: 600 }}>
              {(grouped[stage] ?? []).map((c) => (
                <div
                  key={c.id}
                  draggable
                  onDragStart={() => setDraggingId(c.id)}
                  onDragEnd={() => setDraggingId(null)}
                  className="cursor-move rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
                >
                  <Link href={`/admin/candidates/${c.id}`} className="text-sm font-medium text-teal-700 hover:underline">
                    {c.name ?? c.lineDisplayName ?? "(未登録)"}
                  </Link>
                  <p className="mt-1 text-xs text-slate-500">
                    {c.occupation ? OCCUPATION_LABELS[c.occupation.code] ?? c.occupation.name : "職種未設定"}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <LeadStatusBadge status={c.leadStatus} />
                    <span className="text-xs text-slate-400">{c.assignedStaff?.name ?? "未割当"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
