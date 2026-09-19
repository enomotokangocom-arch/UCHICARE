"use client";

import { useEffect, useState } from "react";

interface NotificationSettingsData {
  slackWebhookUrl: string | null;
  notifyOnCriticalAlert: boolean;
  dailyDigestEnabled: boolean;
  digestEmailRecipients: string[];
}

const EMPTY: NotificationSettingsData = {
  slackWebhookUrl: null,
  notifyOnCriticalAlert: false,
  dailyDigestEnabled: false,
  digestEmailRecipients: [],
};

export function NotificationSettings() {
  const [data, setData] = useState<NotificationSettingsData>(EMPTY);
  const [emailsDraft, setEmailsDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/uchi-os/organization/notifications")
      .then((r) => r.json())
      .then((body) => {
        const notifications: NotificationSettingsData = body.notifications ?? EMPTY;
        setData(notifications);
        setEmailsDraft(notifications.digestEmailRecipients.join(", "));
      })
      .finally(() => setIsLoading(false));
  }, []);

  async function handleSave() {
    setIsSaving(true);
    setMessage(null);
    try {
      const digestEmailRecipients = emailsDraft
        .split(",")
        .map((e) => e.trim())
        .filter((e) => e.length > 0);

      const response = await fetch("/api/uchi-os/organization/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slackWebhookUrl: data.slackWebhookUrl || null,
          notifyOnCriticalAlert: data.notifyOnCriticalAlert,
          dailyDigestEnabled: data.dailyDigestEnabled,
          digestEmailRecipients,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setMessage(body?.error?.message ?? "保存に失敗しました");
        return;
      }
      const body = await response.json();
      setData(body.notifications);
      setMessage("通知設定を保存しました");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) return <p className="text-sm text-neutral-400">読み込み中...</p>;

  return (
    <div className="space-y-3">
      {message && <p className="text-xs text-emerald-700">{message}</p>}

      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-500">Slack Webhook URL</label>
        <input
          type="url"
          value={data.slackWebhookUrl ?? ""}
          onChange={(e) => setData({ ...data, slackWebhookUrl: e.target.value })}
          placeholder="https://hooks.slack.com/services/..."
          className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-neutral-700">
        <input
          type="checkbox"
          checked={data.notifyOnCriticalAlert}
          onChange={(e) => setData({ ...data, notifyOnCriticalAlert: e.target.checked })}
        />
        CRITICAL Alert発生時にSlackへ通知する
      </label>

      <label className="flex items-center gap-2 text-sm text-neutral-700">
        <input
          type="checkbox"
          checked={data.dailyDigestEnabled}
          onChange={(e) => setData({ ...data, dailyDigestEnabled: e.target.checked })}
        />
        日次レポートを自動送信する(Slack + メール)
      </label>

      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-500">日次レポート送信先メールアドレス(カンマ区切り)</label>
        <input
          type="text"
          value={emailsDraft}
          onChange={(e) => setEmailsDraft(e.target.value)}
          placeholder="owner@example.jp, manager@example.jp"
          className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={isSaving}
        className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-40"
      >
        保存
      </button>
    </div>
  );
}
