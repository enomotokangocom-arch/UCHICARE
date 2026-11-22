"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import { surveyList } from "@/lib/surveyDefs";
import { surveyTypeToSlug } from "@/lib/surveySlug";
import { usePortalStore, useCurrentStaff } from "@/lib/portal/store";
import { unitName } from "@/lib/portal/defaults";

const portalNavItems = [
  { href: "/portal", label: "ポータルホーム", icon: "🏢" },
  { href: "/portal/links", label: "外部システム", icon: "🔗" },
  { href: "/portal/notices", label: "社内のお知らせ", icon: "📢" },
  { href: "/portal/alcohol-check", label: "アルコールチェック", icon: "🌬️" },
  { href: "/portal/vehicle-log", label: "運行管理表", icon: "🚗" },
  { href: "/portal/parking", label: "駐車場管理", icon: "🅿️" },
  { href: "/portal/nanbyo", label: "難病 上限管理表", icon: "📑" },
  { href: "/portal/sales", label: "営業管理表", icon: "🤝" },
  { href: "/portal/management", label: "経営数値", icon: "📈" },
  { href: "/portal/minutes", label: "委員会議事録", icon: "🗂️" },
  { href: "/portal/drive", label: "書類フォルダ", icon: "🗄️" },
  { href: "/portal/evaluations", label: "人事評価", icon: "⭐" },
  { href: "/portal/job-descriptions", label: "職務記述書", icon: "📘" },
  { href: "/portal/settings", label: "設定・マスタ", icon: "⚙️" },
];

const healthNavItems = [
  { href: "/health", label: "健康経営ツール ホーム", icon: "🏠" },
  { href: "/dashboard", label: "健康経営ダッシュボード", icon: "📊" },
  { href: "/chat", label: "企業課題チャット", icon: "💬" },
  { href: "/articles", label: "記事自動作成", icon: "📝" },
];

function NavLink({
  href,
  icon,
  label,
  active,
  badge,
  onClick,
}: {
  href: string;
  icon: string;
  label: string;
  active: boolean;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <li>
      <Link
        href={href}
        onClick={onClick}
        className={clsx(
          "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          active ? "bg-teal-50 text-teal-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
        )}
      >
        <span>{icon}</span>
        <span className="flex-1">{label}</span>
        {badge ? (
          <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
            {badge}
          </span>
        ) : null}
      </Link>
    </li>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const staff = usePortalStore((s) => s.staff);
  const notices = usePortalStore((s) => s.notices);
  const setCurrentStaffId = usePortalStore((s) => s.setCurrentStaffId);
  const current = useCurrentStaff();

  const unreadCount = current
    ? notices.filter(
        (n) => (n.units.length === 0 || n.units.includes(current.unitId)) && !n.readBy.includes(current.id)
      ).length
    : 0;

  const isActive = (href: string) =>
    href === "/portal" ? pathname === href : pathname.startsWith(href);
  const close = () => setOpen(false);

  return (
    <>
      {/* スマートフォン用のトップバー */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
          aria-label="メニューを開く"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round" />
          </svg>
        </button>
        <Link href="/portal" className="flex items-center gap-2" onClick={close}>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600 text-sm font-bold text-white">
            U
          </span>
          <span className="text-sm font-bold text-slate-900">Uchi care ポータル</span>
        </Link>
        {unreadCount > 0 && (
          <Link
            href="/portal/notices"
            className="ml-auto rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-bold text-white"
          >
            未読 {unreadCount}
          </Link>
        )}
      </div>

      {open && <div className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden" onClick={close} aria-hidden />}

      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-600 text-lg font-bold text-white">
            U
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold leading-tight text-slate-900">Uchi care</p>
            <p className="text-[11px] leading-tight text-slate-500">社内ポータル</p>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 lg:hidden"
            aria-label="メニューを閉じる"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">社内ポータル</p>
          <ul className="space-y-1">
            {portalNavItems.map((item) => (
              <NavLink
                key={item.href}
                {...item}
                active={isActive(item.href)}
                badge={item.href === "/portal/notices" ? unreadCount : undefined}
                onClick={close}
              />
            ))}
          </ul>

          <p className="mt-6 mb-2 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            健康経営ツール
          </p>
          <ul className="space-y-1">
            {healthNavItems.map((item) => (
              <NavLink key={item.href} {...item} active={isActive(item.href)} onClick={close} />
            ))}
            {surveyList.map((survey) => {
              const href = `/survey/${surveyTypeToSlug(survey.type)}`;
              return (
                <NavLink
                  key={survey.type}
                  href={href}
                  icon={survey.icon}
                  label={survey.shortTitle}
                  active={pathname === href}
                  onClick={close}
                />
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-slate-200 px-4 py-3">
          <label className="block">
            <span className="text-[11px] font-semibold text-slate-400">利用者(ログイン中)</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700"
              value={current?.id ?? ""}
              onChange={(e) => setCurrentStaffId(e.target.value)}
            >
              {staff
                .filter((s) => s.active)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}({s.position}・{unitName(s.unitId)})
                  </option>
                ))}
            </select>
          </label>
        </div>
      </aside>
    </>
  );
}
