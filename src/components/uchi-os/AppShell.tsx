"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";

const NAV_ITEMS = [
  { href: "/uchi-os", label: "CEO Morning", icon: "🏠", mobile: true, phase: 1 },
  { href: "/uchi-os/dashboard/company", label: "Company", icon: "🏢", mobile: false, phase: 1 },
  { href: "/uchi-os/dashboard/financial", label: "Financial", icon: "💰", mobile: false, phase: 1 },
  { href: "/uchi-os/dashboard/workforce", label: "Workforce", icon: "🧑‍⚕️", mobile: false, phase: 1 },
  { href: "/uchi-os/dashboard/sales", label: "Sales", icon: "📈", mobile: false, phase: 1 },
  { href: "/uchi-os/alerts", label: "Alerts", icon: "🔔", mobile: true, phase: 1 },
  { href: "/uchi-os/decisions", label: "AI Decisions", icon: "🧠", mobile: false, phase: 1 },
  { href: "/uchi-os/actions", label: "Action Center", icon: "✅", mobile: true, phase: 1 },
  { href: "/uchi-os/chat", label: "AI経営参謀 Chat", icon: "💬", mobile: true, phase: 1 },
  { href: "/uchi-os/scenarios", label: "Scenario Simulator", icon: "🧪", mobile: false, phase: 1 },
  { href: "/uchi-os/import", label: "Data Import", icon: "📥", mobile: false, phase: 1 },
  { href: "/uchi-os/settings", label: "Settings", icon: "⚙️", mobile: false, phase: 1 },
];

const MOBILE_TABS = NAV_ITEMS.filter((item) => item.mobile);

interface AppShellProps {
  orgName: string;
  userName: string;
  userRole: string;
  children: React.ReactNode;
}

export function AppShell({ orgName, userName, userRole, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/uchi-os/auth/logout", { method: "POST" });
    router.push("/uchi-os/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* デスクトップ: サイドバー (12.3章) */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-neutral-200 bg-white md:flex">
        <div className="flex items-center gap-2 border-b border-neutral-200 px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 text-sm font-bold text-white">
            U
          </div>
          <span className="text-sm font-semibold tracking-tight">Uchi OS</span>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href || (item.href !== "/uchi-os" && pathname?.startsWith(item.href));
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={clsx(
                      "flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100",
                    )}
                  >
                    <span className="flex items-center gap-2.5">
                      <span aria-hidden>{item.icon}</span>
                      {item.label}
                    </span>
                    {item.phase > 1 && (
                      <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] text-neutral-500">
                        Phase{item.phase}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="border-t border-neutral-200 px-4 py-3">
          <p className="truncate text-xs font-medium text-neutral-700">{orgName}</p>
          <p className="truncate text-[11px] text-neutral-400">
            {userName} ({userRole})
          </p>
          <button
            onClick={handleLogout}
            className="mt-2 text-[11px] font-medium text-neutral-400 hover:text-neutral-700"
          >
            ログアウト
          </button>
        </div>
      </aside>

      {/* モバイル/デスクトップ共通ヘッダー */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3 md:hidden">
          <span className="text-sm font-semibold">Uchi OS</span>
          <span className="text-xs text-neutral-500">{orgName}</span>
        </header>

        <main className="min-w-0 flex-1 pb-16 md:pb-0">{children}</main>

        {/* モバイル: 下部タブナビ (12.2章) */}
        <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-neutral-200 bg-white md:hidden">
          {MOBILE_TABS.map((item) => {
            const active = pathname === item.href || (item.href !== "/uchi-os" && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px]",
                  active ? "text-neutral-900" : "text-neutral-400",
                )}
              >
                <span aria-hidden className="text-base">
                  {item.icon}
                </span>
                {item.label === "CEO Morning" ? "Home" : item.label.split(" ")[0]}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
