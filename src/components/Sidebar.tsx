"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { surveyList } from "@/lib/surveyDefs";
import { surveyTypeToSlug } from "@/lib/surveySlug";

const mainNavItems = [
  { href: "/", label: "ホーム", icon: "🏠" },
  { href: "/dashboard", label: "健康経営ダッシュボード", icon: "📊" },
  { href: "/chat", label: "企業課題チャット", icon: "💬" },
  { href: "/articles", label: "記事自動作成", icon: "📝" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-600 text-lg font-bold text-white">
          U
        </div>
        <div>
          <p className="text-sm font-bold leading-tight text-slate-900">UCHICARE</p>
          <p className="text-[11px] leading-tight text-slate-500">健康経営データ可視化</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {mainNavItems.map((item) => {
            const active = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={clsx(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-teal-50 text-teal-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <span>{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <p className="mt-6 mb-2 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          調査票を回答する
        </p>
        <ul className="space-y-1">
          {surveyList.map((survey) => {
            const href = `/survey/${surveyTypeToSlug(survey.type)}`;
            const active = pathname === href;
            return (
              <li key={survey.type}>
                <Link
                  href={href}
                  className={clsx(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-teal-50 text-teal-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <span>{survey.icon}</span>
                  {survey.shortTitle}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-slate-200 px-4 py-3">
        <p className="text-xs font-medium text-slate-700">サンプル株式会社</p>
        <p className="text-[11px] text-slate-400">健康経営 推進担当者 様</p>
      </div>
    </aside>
  );
}
