"use client";
import { useActionState } from "react";
import { loginAction } from "@/mos/server/actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <label className="block text-sm">
        <span className="text-slate-700">メールアドレス</span>
        <input name="email" type="email" autoComplete="username" required className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
      </label>
      <label className="block text-sm">
        <span className="text-slate-700">パスワード</span>
        <input name="password" type="password" autoComplete="current-password" required className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
      </label>
      {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <button disabled={pending} className="w-full rounded-md bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60">
        {pending ? "確認中…" : "ログイン"}
      </button>
    </form>
  );
}
