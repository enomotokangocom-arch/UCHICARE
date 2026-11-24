"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import clsx from "clsx";
import { supabase } from "@/lib/supabase";
import { authErrorMessage, useAuth } from "@/lib/portal/auth";

const input =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";
const primary =
  "w-full rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50";

type Tab = "login" | "register" | "forgot";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center">
          <Image src="/brand/uchicare-logo.png" alt="Uchi care" width={509} height={121} className="h-10 w-auto" loading="eager" />
          <span className="mt-2 flex items-center gap-1.5 text-xs font-semibold tracking-widest text-gold-600">
            <span className="h-px w-4 bg-gold-400" />
            社内ポータル
            <span className="h-px w-4 bg-gold-400" />
          </span>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">{children}</div>
      </div>
    </div>
  );
}

export function LoginScreen() {
  const [tab, setTab] = useState<Tab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 自動ログアウトなどの理由を最初に表示する
  const [info, setInfo] = useState<string | null>(() => useAuth.getState().error);

  function switchTab(t: Tab) {
    setTab(t);
    setError(null);
    setInfo(null);
  }

  async function login(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setError(authErrorMessage(error.message));
  }

  async function register(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("パスワードは8文字以上にしてください。");
    if (password !== password2) return setError("確認用のパスワードが一致しません。");
    setBusy(true);
    try {
      const { data: check, error: checkError } = await supabase().rpc("check_portal_invite", { p_email: email.trim(), p_code: code.trim() });
      if (checkError) throw new Error(authErrorMessage(checkError.message));
      if (check === "registered") throw new Error("このメールアドレスはすでに登録されています。「ログイン」からログインしてください。");
      if (check !== "ok") throw new Error("メールアドレスまたは招待コードが正しくありません。管理者に確認してください。");
      const { data, error } = await supabase().auth.signUp({
        email: email.trim(),
        password,
        options: { data: { invite_code: code.trim().toUpperCase() } },
      });
      if (error) throw new Error(authErrorMessage(error.message));
      if (!data.session) {
        setTab("login");
        setInfo("登録しました。確認メールが届いた場合はリンクを開いてからログインしてください。");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function forgot(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase().auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
    setBusy(false);
    if (error) setError(authErrorMessage(error.message));
    else setInfo("パスワード再設定のメールを送りました。届かない場合は管理者に連絡してください。");
  }

  return (
    <AuthShell>
      {tab !== "forgot" && (
        <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-sm font-semibold">
          {(
            [
              ["login", "ログイン"],
              ["register", "はじめての登録"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => switchTab(id)}
              className={clsx("rounded-md py-2", tab === id ? "bg-white text-brand-700 shadow-sm" : "text-slate-500")}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {tab === "login" && (
        <form onSubmit={login} className="space-y-4">
          <label className="block text-xs font-semibold text-slate-600">
            メールアドレス
            <input type="email" autoComplete="email" required className={`${input} mt-1`} value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            パスワード
            <input type="password" autoComplete="current-password" required className={`${input} mt-1`} value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button type="submit" className={primary} disabled={busy}>
            {busy ? "ログインしています..." : "ログイン"}
          </button>
          <button type="button" className="w-full text-xs text-slate-500 hover:text-brand-700" onClick={() => switchTab("forgot")}>
            パスワードを忘れた場合
          </button>
        </form>
      )}

      {tab === "register" && (
        <form onSubmit={register} className="space-y-4">
          <p className="text-xs leading-relaxed text-slate-500">管理者から伝えられた招待コードと、自分のメールアドレスで登録し、パスワードを決めてください。</p>
          <label className="block text-xs font-semibold text-slate-600">
            メールアドレス
            <input type="email" autoComplete="email" required className={`${input} mt-1`} value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            招待コード(6文字)
            <input
              required
              autoComplete="one-time-code"
              className={`${input} mt-1 font-mono uppercase tracking-[0.3em]`}
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            パスワード(8文字以上)
            <input type="password" autoComplete="new-password" required minLength={8} className={`${input} mt-1`} value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            パスワード(確認)
            <input type="password" autoComplete="new-password" required minLength={8} className={`${input} mt-1`} value={password2} onChange={(e) => setPassword2(e.target.value)} />
          </label>
          <button type="submit" className={primary} disabled={busy}>
            {busy ? "登録しています..." : "登録してはじめる"}
          </button>
        </form>
      )}

      {tab === "forgot" && (
        <form onSubmit={forgot} className="space-y-4">
          <h2 className="text-sm font-bold text-slate-900">パスワードの再設定</h2>
          <p className="text-xs leading-relaxed text-slate-500">登録したメールアドレスに、再設定のリンクを送ります。</p>
          <label className="block text-xs font-semibold text-slate-600">
            メールアドレス
            <input type="email" required className={`${input} mt-1`} value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <button type="submit" className={primary} disabled={busy}>
            再設定のメールを送る
          </button>
          <button type="button" className="w-full text-xs text-slate-500 hover:text-brand-700" onClick={() => switchTab("login")}>
            ← ログインに戻る
          </button>
        </form>
      )}

      {error && <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">⚠ {error}</p>}
      {info && <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{info}</p>}
    </AuthShell>
  );
}

/** パスワード再設定メールのリンクから戻ってきたとき */
export function NewPasswordScreen() {
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("パスワードは8文字以上にしてください。");
    if (password !== password2) return setError("確認用のパスワードが一致しません。");
    setBusy(true);
    const { error } = await supabase().auth.updateUser({ password });
    setBusy(false);
    if (error) setError(authErrorMessage(error.message));
    else useAuth.setState({ status: "loading" });
  }

  return (
    <AuthShell>
      <form onSubmit={submit} className="space-y-4">
        <h2 className="text-sm font-bold text-slate-900">新しいパスワードを決めてください</h2>
        <input type="password" autoComplete="new-password" placeholder="新しいパスワード(8文字以上)" className={input} value={password} onChange={(e) => setPassword(e.target.value)} />
        <input type="password" autoComplete="new-password" placeholder="もう一度入力" className={input} value={password2} onChange={(e) => setPassword2(e.target.value)} />
        <button type="submit" className={primary} disabled={busy}>
          パスワードを変更する
        </button>
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">⚠ {error}</p>}
      </form>
    </AuthShell>
  );
}
