"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { IMPORT_STATUS_LABEL } from "@/mos/ui/Badges";

type Result = { fileName: string; status: string; batchId?: string; error?: string };

export function UploadForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/mos/imports", { method: "POST", body: new FormData(e.currentTarget) });
      const body = await res.json().catch(() => ({ error: "サーバーの応答を読み取れません" }));
      if (!res.ok) setError(body.error ?? "取込に失敗しました");
      else setResults(body.results);
      router.refresh();
    } catch {
      setError("通信に失敗しました");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input
        name="files"
        type="file"
        multiple
        required
        accept=".csv,.xlsx,.pdf,.zip"
        className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2"
      />
      <label className="block text-sm">
        <span className="text-slate-700">ZEST 経営指標の対象年月</span>
        <span className="ml-1 text-xs text-slate-500">（ZEST の zip を取込むときのみ必須。ファイルに期間が含まれないため）</span>
        <input name="zestYearMonth" type="month" className="mt-1 block rounded-md border border-slate-300 px-2 py-1" />
      </label>
      <button disabled={pending} className="rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60">
        {pending ? "取込中…" : "取込む"}
      </button>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {results.length > 0 && (
        <ul className="space-y-1 text-sm" aria-live="polite">
          {results.map((r, i) => (
            <li key={i}>
              {r.fileName}: <strong>{IMPORT_STATUS_LABEL[r.status] ?? r.status}</strong>
              {r.error && `（${r.error}）`}
              {r.batchId && (
                <Link href={`/mos/imports/${r.batchId}`} className="ml-2 text-teal-700 underline">
                  詳細
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
