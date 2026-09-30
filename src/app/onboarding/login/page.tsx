"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/onboarding/ui/client";
import { Alert, Button, Field, inputCls } from "@/onboarding/ui/kit";

type Status = { needsInit: boolean; demo: boolean };

const DEMO_USERS = [
  ["admin", "管理者"], ["prep1", "準備担当者"], ["jimu", "事務・発行責任者"], ["viewer", "閲覧者"],
];

export default function LoginPage() {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    fetch("/api/onboarding/auth/status", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? "");
        setStatus(await r.json());
      })
      .catch((e) => setError(
        "サーバーに接続できないか、サーバーでエラーが起きています。Node.js 22.13 以上で起動しているか、サーバーの画面にエラーが出ていないか確認してください。" +
        (e?.message ? `\n(${e.message})` : ""),
      ));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/auth/login", { method: "POST", body: { login_id: loginId.trim(), password } });
      // ログイン状態(Cookie)が保存されたか確認してから移動する
      const me = await fetch("/api/onboarding/me", { cache: "no-store" });
      if (!me.ok) {
        setError("パスワードは正しいのですが、ブラウザにログイン状態を保存できませんでした。ブラウザのCookieが無効になっていないか確認してください。");
        return;
      }
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.href = next && next.startsWith("/onboarding") && !next.startsWith("/onboarding/login") ? next : "/onboarding";
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div>
          <p className="text-xs font-semibold text-teal-700">株式会社Uchi care</p>
          <h1 className="mt-1 text-xl font-bold text-slate-900">入職前システム準備管理</h1>
          <p className="mt-1 text-xs text-slate-500">新入職員のiPhone・iPad設定とアカウント準備を管理します。</p>
        </div>
        {status?.needsInit && (
          <Alert tone="warn">
            ユーザーがまだ登録されていません。サーバーで次のどちらかを実行してから、もう一度開いてください。{"\n"}
            ・デモ: npm run onboarding:demo{"\n"}・実データ: npm run onboarding:init
          </Alert>
        )}
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="ログインID">
          <input id="login-id" className={inputCls} value={loginId} onChange={(e) => setLoginId(e.target.value)} autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} required />
        </Field>
        <Field label="パスワード">
          <input id="login-password" className={inputCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </Field>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "確認中..." : "ログイン"}
        </Button>
        {status?.demo && (
          <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900 ring-1 ring-amber-200">
            <p className="font-semibold">デモ用ログイン(架空データ)</p>
            <p className="mt-1">パスワードはすべて <code className="rounded bg-white px-1">demo-pass-2026</code></p>
            <div className="mt-2 flex flex-wrap gap-1">
              {DEMO_USERS.map(([id, label]) => (
                <button key={id} type="button" className="rounded border border-amber-300 bg-white px-2 py-1 hover:bg-amber-100"
                  onClick={() => { setLoginId(id); setPassword("demo-pass-2026"); }}>
                  {label}({id})
                </button>
              ))}
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
