"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface CampaignListItem {
  id: string;
  title: string;
  category: string;
  status: string;
  aiGenerated: boolean;
  scheduledAt: string | null;
  sentAt: string | null;
  updatedAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "下書き",
  REVIEW: "レビュー中",
  APPROVED: "承認済み",
  SCHEDULED: "予約済み",
  SENT: "配信済み",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  REVIEW: "bg-amber-100 text-amber-700",
  APPROVED: "bg-blue-100 text-blue-700",
  SCHEDULED: "bg-purple-100 text-purple-700",
  SENT: "bg-emerald-100 text-emerald-700",
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([]);
  const [showAiForm, setShowAiForm] = useState(false);
  const [aiInput, setAiInput] = useState({
    targetOccupations: "",
    currentJobs: "",
    recentNews: "",
    staffIntro: "",
    training: "",
    events: "",
    newOffice: "",
    theme: "",
  });
  const [generating, setGenerating] = useState(false);

  const load = useCallback(() => {
    return fetch("/api/crm/campaigns")
      .then((res) => res.json())
      .then((data) => setCampaigns(data.campaigns ?? []));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createManual() {
    const title = prompt("配信タイトルを入力してください");
    if (!title) return;
    await fetch("/api/crm/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, category: "手動作成", body: "" }),
    });
    load();
  }

  async function generateAi() {
    setGenerating(true);
    try {
      await fetch("/api/crm/campaigns/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(aiInput),
      });
      setShowAiForm(false);
      load();
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">配信管理</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAiForm((v) => !v)}
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700"
          >
            ✨ AIで配信案を作成
          </button>
          <button
            onClick={createManual}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
          >
            + 手動で作成
          </button>
        </div>
      </div>

      {showAiForm && (
        <div className="mb-6 rounded-2xl border border-purple-200 bg-purple-50 p-5">
          <h2 className="mb-3 text-sm font-bold text-purple-900">AI配信案の生成</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: "targetOccupations", label: "今月の採用職種" },
              { key: "currentJobs", label: "現在の求人" },
              { key: "recentNews", label: "最近の会社ニュース" },
              { key: "staffIntro", label: "スタッフ紹介" },
              { key: "training", label: "研修" },
              { key: "events", label: "イベント" },
              { key: "newOffice", label: "新拠点" },
              { key: "theme", label: "伝えたいテーマ" },
            ].map((f) => (
              <div key={f.key}>
                <label className="mb-1 block text-xs text-slate-600">{f.label}</label>
                <input
                  value={(aiInput as Record<string, string>)[f.key]}
                  onChange={(e) => setAiInput((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                />
              </div>
            ))}
          </div>
          <button
            onClick={generateAi}
            disabled={generating}
            className="mt-3 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60"
          >
            {generating ? "生成中..." : "3案生成する"}
          </button>
          <p className="mt-2 text-xs text-purple-700">
            生成結果は下書きとして保存されます。内容を確認・編集し、レビュー→承認→予約のフローを経てから配信してください。
          </p>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">タイトル</th>
              <th className="px-4 py-3">カテゴリー</th>
              <th className="px-4 py-3">ステータス</th>
              <th className="px-4 py-3">配信予定/配信日時</th>
              <th className="px-4 py-3">更新日</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {campaigns.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/admin/campaigns/${c.id}`} className="font-medium text-teal-700 hover:underline">
                    {c.aiGenerated && "✨ "}
                    {c.title}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{c.category}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[c.status]}`}>
                    {STATUS_LABELS[c.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {c.sentAt
                    ? new Date(c.sentAt).toLocaleString("ja-JP")
                    : c.scheduledAt
                      ? new Date(c.scheduledAt).toLocaleString("ja-JP")
                      : "―"}
                </td>
                <td className="px-4 py-3 text-slate-500">{new Date(c.updatedAt).toLocaleDateString("ja-JP")}</td>
              </tr>
            ))}
            {campaigns.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  配信案はまだありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
