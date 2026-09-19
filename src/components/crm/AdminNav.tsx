"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import type { StaffRole } from "@/lib/crm/auth";

const navItems: Array<{ href: string; label: string; icon: string; adminOnly?: boolean }> = [
  { href: "/admin", label: "Today's Action", icon: "🔥" },
  { href: "/admin/dashboard", label: "採用ダッシュボード", icon: "📊" },
  { href: "/admin/talent-pool", label: "Talent Pool", icon: "🗂️" },
  { href: "/admin/candidates", label: "候補者一覧", icon: "🧑‍🤝‍🧑" },
  { href: "/admin/kanban", label: "選考カンバン", icon: "🗃️" },
  { href: "/admin/campaigns", label: "配信管理", icon: "📣" },
  { href: "/admin/notifications", label: "通知", icon: "🔔" },
  { href: "/admin/masters", label: "マスタ管理", icon: "⚙️", adminOnly: true },
  { href: "/admin/lead-score", label: "Lead Score設定", icon: "🌡️", adminOnly: true },
  { href: "/admin/rich-menu", label: "リッチメニュー", icon: "📱", adminOnly: true },
  { href: "/admin/users", label: "スタッフ管理", icon: "👤", adminOnly: true },
];

export function AdminNav({ role }: { role: StaffRole }) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4">
      <ul className="space-y-1">
        {navItems
          .filter((item) => !item.adminOnly || role === "ADMIN")
          .map((item) => {
            const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={clsx(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active ? "bg-teal-50 text-teal-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <span>{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            );
          })}
      </ul>
    </nav>
  );
}
