"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import { surveyList } from "@/lib/surveyDefs";
import { surveyTypeToSlug } from "@/lib/surveySlug";
import { usePortalStore, useCurrentStaff } from "@/lib/portal/store";
import { MANUAL_URL, unitName } from "@/lib/portal/defaults";
import { canViewHealthTool, financeScope } from "@/lib/portal/logic";
import { signOut, useAuth } from "@/lib/portal/auth";

type NavItem = { href: string; label: string; icon: string; external?: boolean; financeOnly?: boolean };

/** 業務の種類ごとにまとめたメニュー(よく使うものほど上) */
const portalNavGroups: { title: string; items: NavItem[] }[] = [
  {
    title: "毎日の業務",
    items: [
      { href: "/portal", label: "ポータルホーム", icon: "🏢" },
      { href: "/portal/alcohol-check", label: "アルコールチェック", icon: "🌬️" },
      { href: "/portal/vehicle-log", label: "運行管理表", icon: "🚗" },
      { href: "/portal/notices", label: "社内のお知らせ", icon: "📢" },
      { href: "/portal/links", label: "外部システム", icon: "🔗" },
      { href: MANUAL_URL, label: "マニュアル", icon: "📖", external: true },
    ],
  },
  {
    title: "記録・管理",
    items: [
      { href: "/portal/minutes", label: "委員会議事録", icon: "🗂️" },
      { href: "/portal/nanbyo", label: "難病 上限管理表", icon: "📑" },
      { href: "/portal/sales", label: "営業管理表", icon: "🤝" },
      { href: "/portal/parking", label: "車両・駐車場", icon: "🚙" },
      { href: "/portal/drive", label: "書類フォルダ", icon: "🗄️" },
    ],
  },
  {
    title: "人・組織",
    items: [
      { href: "/portal/consultation", label: "相談窓口", icon: "💬" },
      { href: "/portal/goals", label: "目標管理", icon: "🎯" },
      { href: "/portal/evaluations", label: "人事評価", icon: "⭐" },
      { href: "/portal/philosophy", label: "理念(MVV)", icon: "🧭" },
      { href: "/portal/job-descriptions", label: "職務記述書", icon: "📘" },
    ],
  },
  {
    title: "経営・設定",
    items: [
      { href: "/portal/management", label: "経営数値", icon: "📈" },
      { href: "/portal/sales-upload", label: "売上データ取り込み", icon: "📥", financeOnly: true },
      { href: "/portal/settings", label: "設定・マスタ", icon: "⚙️" },
    ],
  },
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
  external,
  onClick,
}: {
  href: string;
  icon: string;
  label: string;
  active: boolean;
  badge?: number;
  external?: boolean;
  onClick: () => void;
}) {
  if (external) {
    return (
      <li>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClick}
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-brand-700"
        >
          <span>{icon}</span>
          <span className="flex-1">{label}</span>
          <span className="text-xs text-slate-300">↗</span>
        </a>
      </li>
    );
  }
  return (
    <li>
      <Link
        href={href}
        onClick={onClick}
        className={clsx(
          "relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          active
            ? "bg-brand-50 font-semibold text-brand-700 before:absolute before:inset-y-1.5 before:left-0 before:w-1 before:rounded-full before:bg-gold-400"
            : "text-slate-600 hover:bg-slate-50 hover:text-brand-700"
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
  const member = useAuth((s) => s.member);
  const fscope = financeScope(current);
  const canImportSales = fscope.all || fscope.units.length > 0;

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
          <Image src="/brand/uchicare-logo.png" alt="Uchi care" width={509} height={121} className="h-7 w-auto" loading="eager" />
          <span className="text-[11px] font-semibold tracking-wide text-gold-600">社内ポータル</span>
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
          <Link href="/portal" onClick={close} className="flex-1">
            <Image src="/brand/uchicare-logo.png" alt="Uchi care" width={509} height={121} className="h-9 w-auto" loading="eager" />
            <span className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-widest text-gold-600">
              <span className="h-px w-4 bg-gold-400" />
              社内ポータル
            </span>
          </Link>
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
          {portalNavGroups.map((group, gi) => (
            <div key={group.title} className={gi > 0 ? "mt-5" : ""}>
              <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-wide text-slate-400">{group.title}</p>
              <ul className="space-y-0.5">
                {group.items.filter((item) => !item.financeOnly || canImportSales).map((item) => (
                  <NavLink
                    key={item.href}
                    {...item}
                    active={isActive(item.href)}
                    badge={item.href === "/portal/notices" ? unreadCount : undefined}
                    onClick={close}
                  />
                ))}
              </ul>
            </div>
          ))}

          {canViewHealthTool(current) && (
          <>
          <p className="mt-6 mb-2 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            健康経営ツール(責任者以上)
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
          </>
          )}
        </nav>

        <div className="border-t border-slate-200 px-4 py-3">
          {member && (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-slate-700">{member.name || member.email}</p>
                <p className="truncate text-[11px] text-slate-400">
                  {member.position}・{unitName(member.unit_id)}
                </p>
              </div>
              <button type="button" onClick={() => signOut()} className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-rose-600">
                ログアウト
              </button>
            </div>
          )}
          {member?.is_admin && (
            <label className="mt-2 block">
              <span className="text-[11px] font-semibold text-slate-400">表示を切り替え(管理者のみ)</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700"
                value={current?.id ?? ""}
                onChange={(e) => setCurrentStaffId(e.target.value)}
              >
                {staff
                  .filter((s) => s.active)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.id === member.staff_id ? "★ " : ""}
                      {s.name}({s.position}・{unitName(s.unitId)})
                    </option>
                  ))}
              </select>
            </label>
          )}
        </div>
      </aside>
    </>
  );
}
