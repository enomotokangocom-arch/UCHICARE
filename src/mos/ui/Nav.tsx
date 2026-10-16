"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "../domain/types";

const ITEMS: { href: string; label: string; roles: Role[] }[] = [
  { href: "/mos", label: "経営ダッシュボード", roles: ["ADMIN", "MANAGER", "STAFF"] },
  { href: "/mos/pl", label: "損益計算", roles: ["ADMIN", "MANAGER"] },
  { href: "/mos/imports", label: "ファイル取込", roles: ["ADMIN", "MANAGER"] },
  { href: "/mos/transactions", label: "未分類取引", roles: ["ADMIN", "MANAGER"] },
  { href: "/mos/reconciliation", label: "試算表との照合", roles: ["ADMIN", "MANAGER"] },
  { href: "/mos/closing", label: "月次確定", roles: ["ADMIN"] },
  { href: "/mos/settings", label: "設定", roles: ["ADMIN"] },
];

export function Nav({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = ITEMS.filter((i) => i.roles.includes(role));
  return (
    <nav aria-label="メインメニュー" className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
      {items.map((i) => {
        const active = i.href === "/mos" ? pathname === "/mos" : pathname.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 whitespace-nowrap rounded-md px-3 py-2 text-sm ${active ? "bg-teal-600 font-semibold text-white" : "text-slate-700 hover:bg-slate-100"}`}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
