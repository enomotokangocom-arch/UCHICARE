"use client";

import { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import {
  OCCUPATION_LABELS,
  TRANSFER_TIMING_LABELS,
  CANDIDATE_STAGE_LABELS,
  CANDIDATE_STAGE_ORDER,
} from "@/lib/crm/constants";
import { LeadStatusBadge, StageBadge } from "@/components/crm/Badges";

interface CandidateDetail {
  id: string;
  name: string | null;
  lineDisplayName: string | null;
  phone: string | null;
  email: string | null;
  memo: string | null;
  leadStatus: string;
  leadScore: number;
  stage: string;
  transferTiming: string | null;
  occupation: { id: string; code: string; name: string } | null;
  area: { id: string; name: string } | null;
  inflowSource: { name: string; channel: string } | null;
  assignedStaff: { id: string; name: string } | null;
  registeredAt: string;
  lastLineReactionAt: string | null;
  lastStaffContactAt: string | null;
  tags: Array<{ tag: { id: string; label: string; category: string } }>;
  events: Array<{ id: string; type: string; label: string | null; createdAt: string; actorType: string; actorStaff?: { name: string } | null }>;
}

function formatDateTime(value: string | null) {
  if (!value) return "―";
  return new Date(value).toLocaleString("ja-JP", { dateStyle: "medium", timeStyle: "short" });
}

export default function CandidateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [candidate, setCandidate] = useState<CandidateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [staffList, setStaffList] = useState<Array<{ id: string; name: string }>>([]);

  const load = useCallback(() => {
    return Promise.resolve()
      .then(() => setLoading(true))
      .then(() => fetch(`/api/crm/candidates/${id}`))
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setCandidate(data.candidate);
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    load();
    fetch("/api/crm/staff")
      .then((r) => r.json())
      .then((d) => setStaffList(d.staff ?? []));
  }, [load]);

  async function updateField(field: string, value: unknown) {
    await fetch(`/api/crm/candidates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    load();
  }

  async function changeStage(stage: string) {
    await fetch(`/api/crm/candidates/${id}/stage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
    load();
  }

  async function submitNote() {
    if (!noteText.trim()) return;
    setSavingNote(true);
    await fetch(`/api/crm/candidates/${id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activityType: "CONTACT", note: noteText }),
    });
    setNoteText("");
    setSavingNote(false);
    load();
  }

  if (loading && !candidate) {
    return <div className="p-8 text-slate-500">読み込み中...</div>;
  }
  if (!candidate) {
    return <div className="p-8 text-slate-500">候補者が見つかりません。</div>;
  }

  return (
    <div className="mx-auto max-w-5xl p-8">
      <Link href="/admin/candidates" className="text-sm text-teal-700 hover:underline">
        ← 候補者一覧へ戻る
      </Link>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{candidate.name ?? candidate.lineDisplayName ?? "(未登録)"}</h1>
            <p className="text-sm text-slate-500">LINE表示名: {candidate.lineDisplayName ?? "―"}</p>
          </div>
          <div className="flex items-center gap-2">
            <LeadStatusBadge status={candidate.leadStatus} />
            <span className="text-sm text-slate-500">Score: {candidate.leadScore}</span>
            <StageBadge stage={candidate.stage} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div>
            <p className="text-xs text-slate-400">職種</p>
            <p className="text-sm font-medium">
              {candidate.occupation ? OCCUPATION_LABELS[candidate.occupation.code] ?? candidate.occupation.name : "―"}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">転職時期</p>
            <p className="text-sm font-medium">
              {candidate.transferTiming ? TRANSFER_TIMING_LABELS[candidate.transferTiming] : "―"}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">希望エリア</p>
            <p className="text-sm font-medium">{candidate.area?.name ?? "―"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">流入経路</p>
            <p className="text-sm font-medium">{candidate.inflowSource?.name ?? "―"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">登録日</p>
            <p className="text-sm font-medium">{formatDateTime(candidate.registeredAt)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">最終LINE反応日</p>
            <p className="text-sm font-medium">{formatDateTime(candidate.lastLineReactionAt)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">最終スタッフ接触日</p>
            <p className="text-sm font-medium">{formatDateTime(candidate.lastStaffContactAt)}</p>
          </div>
          <div>
            <p className="mb-1 text-xs text-slate-400">担当者</p>
            <select
              defaultValue={candidate.assignedStaff?.id ?? ""}
              onChange={(e) => updateField("assignedStaffId", e.target.value || null)}
              className="rounded-md border border-slate-300 px-2 py-1 text-sm"
            >
              <option value="">未割当</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <p className="mb-1 text-xs text-slate-400">ステージ変更</p>
          <select
            value={candidate.stage}
            onChange={(e) => changeStage(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1 text-sm"
          >
            {CANDIDATE_STAGE_ORDER.map((s) => (
              <option key={s} value={s}>
                {CANDIDATE_STAGE_LABELS[s]}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 flex flex-wrap gap-1">
          {candidate.tags.map((t) => (
            <span key={t.tag.id} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {t.tag.label}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="mb-3 text-sm font-bold text-slate-900">連絡先・メモ</h2>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-slate-400">氏名</label>
              <input
                defaultValue={candidate.name ?? ""}
                onBlur={(e) => updateField("name", e.target.value || null)}
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">電話番号</label>
              <input
                defaultValue={candidate.phone ?? ""}
                onBlur={(e) => updateField("phone", e.target.value || null)}
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">メールアドレス</label>
              <input
                defaultValue={candidate.email ?? ""}
                onBlur={(e) => updateField("email", e.target.value || null)}
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">メモ</label>
              <textarea
                defaultValue={candidate.memo ?? ""}
                onBlur={(e) => updateField("memo", e.target.value || null)}
                rows={4}
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
              />
            </div>
          </div>

          <div className="mt-4 border-t border-slate-100 pt-4">
            <label className="mb-1 block text-xs text-slate-400">対応記録を追加</label>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={2}
              placeholder="例: 電話で希望条件をヒアリング"
              className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
            />
            <button
              onClick={submitNote}
              disabled={savingNote}
              className="mt-2 rounded-md bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
            >
              記録する
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="mb-3 text-sm font-bold text-slate-900">タイムライン</h2>
          <ol className="space-y-3 max-h-[500px] overflow-y-auto">
            {candidate.events.map((ev) => (
              <li key={ev.id} className="border-l-2 border-teal-200 pl-3">
                <p className="text-xs text-slate-400">{formatDateTime(ev.createdAt)}</p>
                <p className="text-sm text-slate-700">
                  {ev.label ?? ev.type}
                  {ev.actorType === "STAFF" && ev.actorStaff && (
                    <span className="ml-1 text-xs text-slate-400">(担当: {ev.actorStaff.name})</span>
                  )}
                </p>
              </li>
            ))}
            {candidate.events.length === 0 && <p className="text-sm text-slate-400">イベントはまだありません。</p>}
          </ol>
        </div>
      </div>
    </div>
  );
}
