"use client";

import { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";

interface CampaignDetail {
  id: string;
  title: string;
  category: string;
  body: string;
  ctaLabel: string | null;
  ctaUrl: string | null;
  status: string;
  aiGenerated: boolean;
  scheduledAt: string | null;
  sentAt: string | null;
  createdByStaff: { name: string } | null;
  approvedByStaff: { name: string } | null;
  deliveries: Array<{ status: string }>;
}

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [body, setBody] = useState("");
  const [title, setTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    return fetch(`/api/crm/campaigns/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setCampaign(data.campaign);
          setBody(data.campaign.body);
          setTitle(data.campaign.title);
        }
      });
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveDraft() {
    const res = await fetch(`/api/crm/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body }),
    });
    if (res.ok) {
      setMessage("保存しました。");
      load();
    } else {
      const data = await res.json();
      setMessage(data.error ?? "保存に失敗しました。");
    }
  }

  async function transition(action: "submit-review" | "approve" | "send") {
    const res = await fetch(`/api/crm/campaigns/${id}/${action}`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "処理に失敗しました。");
      return;
    }
    setMessage(null);
    load();
  }

  async function schedule() {
    if (!scheduledAt) {
      setMessage("配信予定日時を選択してください。");
      return;
    }
    const res = await fetch(`/api/crm/campaigns/${id}/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledAt: new Date(scheduledAt).toISOString() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "予約に失敗しました。");
      return;
    }
    load();
  }

  if (!campaign) return <div className="p-8 text-slate-500">読み込み中...</div>;

  const editable = campaign.status === "DRAFT" || campaign.status === "REVIEW";

  return (
    <div className="mx-auto max-w-3xl p-8">
      <Link href="/admin/campaigns" className="text-sm text-teal-700 hover:underline">
        ← 配信管理へ戻る
      </Link>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-bold text-slate-900">配信案の編集</h1>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{campaign.status}</span>
        </div>

        {message && <p className="mb-3 text-sm font-medium text-rose-600">{message}</p>}

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-slate-400">タイトル(社内管理用)</label>
            <input
              value={title}
              disabled={!editable}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">本文</label>
            <textarea
              value={body}
              disabled={!editable}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-50"
            />
          </div>
        </div>

        {editable && (
          <button onClick={saveDraft} className="mt-3 rounded-lg border border-slate-300 px-4 py-1.5 text-sm font-medium hover:bg-slate-50">
            下書き保存
          </button>
        )}

        <div className="mt-6 border-t border-slate-100 pt-4">
          <h2 className="mb-2 text-sm font-bold text-slate-900">承認ワークフロー</h2>
          <p className="mb-3 text-xs text-slate-500">作成 → レビュー → 承認 → 予約 → 配信 の順に進みます(誤配信防止)。</p>

          <div className="flex flex-wrap gap-2">
            {campaign.status === "DRAFT" && (
              <button
                onClick={() => transition("submit-review")}
                className="rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-600"
              >
                レビューに提出
              </button>
            )}
            {campaign.status === "REVIEW" && (
              <button
                onClick={() => transition("approve")}
                className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                承認する (管理者)
              </button>
            )}
            {campaign.status === "APPROVED" && (
              <>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                />
                <button
                  onClick={schedule}
                  className="rounded-lg bg-purple-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-purple-700"
                >
                  予約する
                </button>
                <button
                  onClick={() => transition("send")}
                  className="rounded-lg bg-rose-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-rose-700"
                >
                  今すぐ配信
                </button>
              </>
            )}
            {campaign.status === "SCHEDULED" && (
              <p className="text-sm text-slate-600">
                {campaign.scheduledAt && new Date(campaign.scheduledAt).toLocaleString("ja-JP")} に配信予定です。
              </p>
            )}
            {campaign.status === "SENT" && (
              <p className="text-sm text-emerald-700">
                配信済み (成功: {campaign.deliveries.filter((d) => d.status === "SENT").length}件 / 失敗:{" "}
                {campaign.deliveries.filter((d) => d.status === "FAILED").length}件)
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
