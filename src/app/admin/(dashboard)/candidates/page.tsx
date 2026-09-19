"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import {
  OCCUPATION_LABELS,
  TRANSFER_TIMING_LABELS,
  LEAD_STATUS_LABELS,
  CANDIDATE_STAGE_LABELS,
  CANDIDATE_STAGE_ORDER,
} from "@/lib/crm/constants";
import { LeadStatusBadge, StageBadge } from "@/components/crm/Badges";

interface Candidate {
  id: string;
  name: string | null;
  lineDisplayName: string | null;
  occupation: { code: string; name: string } | null;
  transferTiming: string | null;
  area: { name: string } | null;
  leadStatus: string;
  leadScore: number;
  stage: string;
  lastLineReactionAt: string | null;
  assignedStaff: { name: string } | null;
}

interface Occupation {
  id: string;
  code: string;
  name: string;
}
interface Area {
  id: string;
  name: string;
}
interface Staff {
  id: string;
  name: string;
}

function formatDate(value: string | null) {
  if (!value) return "―";
  return new Date(value).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" });
}

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [loading, setLoading] = useState(true);

  const [occupations, setOccupations] = useState<Occupation[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);

  const [filters, setFilters] = useState({ occupation: "", timing: "", area: "", leadStatus: "", stage: "", staff: "", q: "" });

  useEffect(() => {
    fetch("/api/crm/occupations")
      .then((r) => r.json())
      .then((d) => setOccupations(d.occupations ?? []));
    fetch("/api/crm/areas")
      .then((r) => r.json())
      .then((d) => setAreas(d.areas ?? []));
    fetch("/api/crm/staff")
      .then((r) => r.json())
      .then((d) => setStaffList(d.staff ?? []));
  }, []);

  const fetchCandidates = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    for (const [key, value] of Object.entries(filters)) {
      if (value) params.set(key, value);
    }
    return Promise.resolve()
      .then(() => setLoading(true))
      .then(() => fetch(`/api/crm/candidates?${params.toString()}`))
      .then((res) => res.json())
      .then((data) => {
        setCandidates(data.candidates ?? []);
        setTotal(data.total ?? 0);
        setLoading(false);
      });
  }, [filters, page]);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const filterSelects = useMemo(
    () => [
      {
        key: "occupation",
        label: "職種",
        options: occupations.map((o) => ({ value: o.code, label: o.name })),
      },
      {
        key: "timing",
        label: "転職時期",
        options: Object.entries(TRANSFER_TIMING_LABELS).map(([value, label]) => ({ value, label })),
      },
      { key: "area", label: "希望エリア", options: areas.map((a) => ({ value: a.id, label: a.name })) },
      {
        key: "leadStatus",
        label: "Lead Status",
        options: Object.entries(LEAD_STATUS_LABELS).map(([value, label]) => ({ value, label })),
      },
      {
        key: "stage",
        label: "ステージ",
        options: CANDIDATE_STAGE_ORDER.map((value) => ({ value, label: CANDIDATE_STAGE_LABELS[value] })),
      },
      { key: "staff", label: "担当者", options: staffList.map((s) => ({ value: s.id, label: s.name })) },
    ],
    [occupations, areas, staffList]
  );

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">候補者一覧</h1>
          <p className="text-sm text-slate-500">{total}件の候補者</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-4">
        {filterSelects.map((f) => (
          <select
            key={f.key}
            value={(filters as Record<string, string>)[f.key]}
            onChange={(e) => {
              setPage(1);
              setFilters((prev) => ({ ...prev, [f.key]: e.target.value }));
            }}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">{f.label}: すべて</option>
            {f.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ))}
        <input
          type="text"
          placeholder="フリーワード検索 (氏名・メール・電話・メモ)"
          value={filters.q}
          onChange={(e) => {
            setPage(1);
            setFilters((prev) => ({ ...prev, q: e.target.value }));
          }}
          className="min-w-[240px] flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">名前</th>
              <th className="px-4 py-3">職種</th>
              <th className="px-4 py-3">転職時期</th>
              <th className="px-4 py-3">希望エリア</th>
              <th className="px-4 py-3">Lead Status</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">ステージ</th>
              <th className="px-4 py-3">最終反応</th>
              <th className="px-4 py-3">担当者</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                  読み込み中...
                </td>
              </tr>
            ) : candidates.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                  該当する候補者がいません。
                </td>
              </tr>
            ) : (
              candidates.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/candidates/${c.id}`} className="font-medium text-teal-700 hover:underline">
                      {c.name ?? c.lineDisplayName ?? "(未登録)"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.occupation ? OCCUPATION_LABELS[c.occupation.code] ?? c.occupation.name : "―"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.transferTiming ? TRANSFER_TIMING_LABELS[c.transferTiming] : "―"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.area?.name ?? "―"}</td>
                  <td className="px-4 py-3">
                    <LeadStatusBadge status={c.leadStatus} />
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.leadScore}</td>
                  <td className="px-4 py-3">
                    <StageBadge stage={c.stage} />
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(c.lastLineReactionAt)}</td>
                  <td className="px-4 py-3 text-slate-600">{c.assignedStaff?.name ?? "未割当"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
        <span>
          {total === 0 ? 0 : (page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} / {total}件
        </span>
        <div className="flex gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-md border border-slate-300 px-3 py-1 disabled:opacity-40"
          >
            前へ
          </button>
          <span>
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded-md border border-slate-300 px-3 py-1 disabled:opacity-40"
          >
            次へ
          </button>
        </div>
      </div>
    </div>
  );
}
