"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { api, Me } from "@/onboarding/ui/client";
import { MeContext } from "@/onboarding/ui/me";
import { ROLE_LABELS } from "@/onboarding/shared/labels";

const NAV = [
  { href: "/onboarding", label: "ダッシュボード", roles: ["admin", "preparer", "issuer", "viewer"] },
  { href: "/onboarding/hires/new", label: "入職者を登録", roles: ["admin"] },
  { href: "/onboarding/apple", label: "Apple番号", roles: ["admin", "preparer"] },
  { href: "/onboarding/devices", label: "端末台帳", roles: ["admin", "preparer"] },
  { href: "/onboarding/manual", label: "部門別手順書", roles: ["admin", "preparer", "issuer"] },
  { href: "/onboarding/settings", label: "管理設定", roles: ["admin"] },
  { href: "/onboarding/guide", label: "使い方", roles: ["admin", "preparer", "issuer", "viewer"] },
];

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname.startsWith("/onboarding/login");
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    if (isLogin) return;
    api<Me>("/me").then(setMe).catch(() => {});
  }, [isLogin, pathname]);

  if (isLogin) return <div className="min-h-screen bg-slate-50">{children}</div>;
  if (!me) return <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">読み込み中...</div>;

  async function logout() {
    await api("/auth/logout", { method: "POST", body: {} }).catch(() => {});
    router.push("/onboarding/login");
  }

  return (
    <MeContext.Provider value={me}>
      <div className="min-h-screen bg-slate-50">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white print:hidden">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/onboarding" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600 text-sm font-bold text-white">U</span>
              <span className="leading-tight">
                <span className="block text-sm font-bold text-slate-900">入職準備管理</span>
                <span className="block text-[10px] text-slate-500">株式会社Uchi care</span>
              </span>
            </Link>
            <nav className="flex flex-1 flex-wrap gap-1">
              {NAV.filter((n) => n.roles.includes(me.actor.role)).map((n) => {
                const active = n.href === "/onboarding" ? pathname === n.href : pathname.startsWith(n.href);
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    className={clsx(
                      "rounded-lg px-3 py-1.5 text-sm font-medium",
                      active ? "bg-teal-50 text-teal-700" : "text-slate-600 hover:bg-slate-100",
                    )}
                  >
                    {n.label}
                  </Link>
                );
              })}
            </nav>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-slate-600">
                {me.actor.name}
                <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">{ROLE_LABELS[me.actor.role]}</span>
              </span>
              <button onClick={logout} className="rounded-lg border border-slate-300 px-2.5 py-1 text-slate-600 hover:bg-slate-50">
                ログアウト
              </button>
            </div>
          </div>
          {me.mode === "demo" && (
            <div className="bg-amber-100 px-4 py-1 text-center text-xs font-semibold text-amber-900">
              デモモード: 表示されている職員・端末はすべて架空のダミーデータです
            </div>
          )}
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 print:max-w-none print:p-0">{children}</main>
      </div>
    </MeContext.Provider>
  );
}
