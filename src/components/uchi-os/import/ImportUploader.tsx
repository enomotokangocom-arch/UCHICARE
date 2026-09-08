"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const ENTITIES: { value: string; label: string }[] = [
  { value: "stations", label: "拠点 (stations)" },
  { value: "financial_monthly", label: "月次財務 (financial_monthly)" },
];

export function ImportUploader() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [entity, setEntity] = useState("stations");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setMessage("CSVファイルを選択してください");
      return;
    }
    setIsSubmitting(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`/api/uchi-os/import/${entity}`, { method: "POST", body: formData });
      const body = await response.json();
      if (!response.ok) {
        setMessage(body?.error?.message ?? "取り込みに失敗しました");
        return;
      }
      setMessage(`取り込み完了: ${body.result.rowCount}行中 ${body.result.errorCount}件エラー`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-neutral-200 bg-white p-5">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-500">データ種別</label>
          <select
            value={entity}
            onChange={(e) => setEntity(e.target.value)}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          >
            {ENTITIES.map((e) => (
              <option key={e.value} value={e.value}>
                {e.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-500">CSVファイル</label>
          <input ref={fileInputRef} type="file" accept=".csv" className="text-sm" />
        </div>
        <a
          href={`/api/uchi-os/import/templates/${entity}`}
          className="text-xs font-medium text-neutral-500 underline hover:text-neutral-900"
        >
          テンプレートをダウンロード
        </a>
        <button
          type="submit"
          disabled={isSubmitting}
          className="ml-auto rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-40"
        >
          {isSubmitting ? "取り込み中..." : "取り込む"}
        </button>
      </div>
      {message && <p className="mt-3 text-sm text-neutral-700">{message}</p>}
    </form>
  );
}
