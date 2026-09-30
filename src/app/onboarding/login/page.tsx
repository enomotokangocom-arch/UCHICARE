"use client";

import { useState } from "react";
import { api, ApiError } from "@/onboarding/ui/client";
import { Alert, Button, Field, inputCls } from "@/onboarding/ui/kit";

export default function LoginPage() {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/auth/login", { method: "POST", body: { login_id: loginId, password } });
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.href = next && next.startsWith("/onboarding") ? next : "/onboarding";
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div>
          <p className="text-xs font-semibold text-teal-700">株式会社Uchi care</p>
          <h1 className="mt-1 text-xl font-bold text-slate-900">入職前システム準備管理</h1>
          <p className="mt-1 text-xs text-slate-500">新入職員のiPhone・iPad設定とアカウント準備を管理します。</p>
        </div>
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="ログインID">
          <input className={inputCls} value={loginId} onChange={(e) => setLoginId(e.target.value)} autoComplete="username" required />
        </Field>
        <Field label="パスワード">
          <input className={inputCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </Field>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "確認中..." : "ログイン"}
        </Button>
        <p className="text-[11px] leading-relaxed text-slate-500">
          ユーザーが未登録の場合は、サーバーで <code className="rounded bg-slate-100 px-1">npm run onboarding:init</code>(実データ用)または{" "}
          <code className="rounded bg-slate-100 px-1">npm run onboarding:demo</code>(デモ用)を実行してください。
        </p>
      </form>
    </div>
  );
}
