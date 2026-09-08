"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/uchi-os";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/uchi-os/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error?.message ?? "ログインに失敗しました");
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Uchi OS</h1>
          <p className="mt-2 text-sm text-neutral-400">医療福祉経営の意思決定をAI化する経営OS</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 shadow-xl backdrop-blur"
        >
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm text-neutral-300">
                メールアドレス
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none focus:border-neutral-400"
                placeholder="owner@example.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm text-neutral-300">
                パスワード
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none focus:border-neutral-400"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-300">{error}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-6 w-full rounded-lg bg-white py-2.5 text-sm font-medium text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-50"
          >
            {isSubmitting ? "ログイン中..." : "ログイン"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-neutral-600">
          デモ環境: seed実行後のOwnerアカウントでログインしてください
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
