"use client";

import { useEffect, useState } from "react";
import { IMPORT_ENTITIES, IMPORT_ENTITY_LABELS, type ImportEntity } from "@/server/uchi-os/import/schemas";

interface ExternalConnection {
  id: string;
  name: string;
  targetEntity: string;
  baseUrl: string;
  authHeaderName: string | null;
  status: "ACTIVE" | "PAUSED" | "ERROR";
  lastSyncedAt: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
}

const STATUS_LABEL: Record<string, string> = { ACTIVE: "有効", PAUSED: "停止中", ERROR: "エラー" };

export function ExternalConnectionsPanel() {
  const [connections, setConnections] = useState<ExternalConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [targetEntity, setTargetEntity] = useState<ImportEntity>("financial_monthly");
  const [baseUrl, setBaseUrl] = useState("");
  const [authHeaderName, setAuthHeaderName] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  function load() {
    setIsLoading(true);
    fetch("/api/uchi-os/external-connections")
      .then((r) => r.json())
      .then((body) => setConnections(body.connections ?? []))
      .finally(() => setIsLoading(false));
  }

  // ThresholdEditor.tsxと同じ理由(一般的なdata-fetching effectパターン)。
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setIsCreating(true);
    setMessage(null);
    try {
      const response = await fetch("/api/uchi-os/external-connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          targetEntity,
          baseUrl,
          authHeaderName: authHeaderName || undefined,
          authToken: authToken || undefined,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        setMessage(body?.error?.message ?? "接続の作成に失敗しました");
        return;
      }
      setName("");
      setBaseUrl("");
      setAuthHeaderName("");
      setAuthToken("");
      load();
    } finally {
      setIsCreating(false);
    }
  }

  async function handleSync(id: string) {
    setSyncingId(id);
    setMessage(null);
    try {
      const response = await fetch(`/api/uchi-os/external-connections/${id}/sync`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) {
        setMessage(body?.error?.message ?? "同期に失敗しました");
      } else {
        setMessage(`同期完了: ${body.result.rowCount}行中 ${body.result.errorCount}件エラー`);
      }
      load();
    } finally {
      setSyncingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("この連携設定を削除しますか?")) return;
    await fetch(`/api/uchi-os/external-connections/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      {message && <p className="mb-3 text-xs text-neutral-700">{message}</p>}

      {isLoading ? (
        <p className="text-sm text-neutral-400">読み込み中...</p>
      ) : (
        <div className="space-y-2">
          {connections.map((c) => (
            <div key={c.id} className="rounded-lg border border-neutral-200 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-neutral-900">{c.name}</span>
                <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] text-neutral-500">
                  {IMPORT_ENTITY_LABELS[c.targetEntity as ImportEntity] ?? c.targetEntity}
                </span>
                <span className="text-[11px] text-neutral-400">{STATUS_LABEL[c.status] ?? c.status}</span>
              </div>
              <p className="mt-1 truncate text-xs text-neutral-500">{c.baseUrl}</p>
              <p className="mt-1 text-[11px] text-neutral-400">
                最終同期: {c.lastSyncedAt ? new Date(c.lastSyncedAt).toLocaleString("ja-JP") : "未実行"}
                {c.lastSyncStatus ? ` (${c.lastSyncStatus})` : ""}
              </p>
              {c.lastSyncError && <p className="mt-1 text-[11px] text-red-600">{c.lastSyncError}</p>}
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => handleSync(c.id)}
                  disabled={syncingId === c.id}
                  className="rounded-lg bg-neutral-900 px-2.5 py-1 text-[11px] font-medium text-white disabled:opacity-40"
                >
                  {syncingId === c.id ? "同期中..." : "今すぐ同期"}
                </button>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="rounded-lg border border-red-200 px-2.5 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50"
                >
                  削除
                </button>
              </div>
            </div>
          ))}
          {connections.length === 0 && <p className="text-sm text-neutral-400">連携設定はまだありません。</p>}
        </div>
      )}

      <form onSubmit={handleCreate} className="mt-4 space-y-2 rounded-lg border border-dashed border-neutral-300 p-3">
        <p className="text-xs font-semibold text-neutral-700">連携を追加</p>
        <div className="flex flex-wrap gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="表示名(例: レセプトシステムA)"
            required
            className="flex-1 rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm"
          />
          <select
            value={targetEntity}
            onChange={(e) => setTargetEntity(e.target.value as ImportEntity)}
            className="rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm"
          >
            {IMPORT_ENTITIES.map((entity) => (
              <option key={entity} value={entity}>
                {IMPORT_ENTITY_LABELS[entity]}
              </option>
            ))}
          </select>
        </div>
        <input
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://api.example.jp/uchi-os-feed"
          required
          type="url"
          className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm"
        />
        <div className="flex flex-wrap gap-2">
          <input
            value={authHeaderName}
            onChange={(e) => setAuthHeaderName(e.target.value)}
            placeholder="認証ヘッダー名(任意、例: Authorization)"
            className="flex-1 rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm"
          />
          <input
            value={authToken}
            onChange={(e) => setAuthToken(e.target.value)}
            placeholder="トークン(任意)"
            type="password"
            className="flex-1 rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={isCreating}
          className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-40"
        >
          追加
        </button>
      </form>
    </div>
  );
}
