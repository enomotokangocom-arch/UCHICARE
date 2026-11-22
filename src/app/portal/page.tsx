"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePortalStore, useCurrentStaff } from "@/lib/portal/store";
import { unitName } from "@/lib/portal/defaults";
import { alcoholChecksFor, committeeStatuses, noticeVisibleTo, sortNotices } from "@/lib/portal/logic";
import { formatDate, formatDateTime, todayString } from "@/lib/portal/util";
import { LinkGrid } from "@/components/portal/LinkGrid";
import { Card, PageContainer, StatusPill, UnitBadge, UnitBadges, buttonClass } from "@/components/portal/ui";

export default function PortalHome() {
  const current = useCurrentStaff();
  const links = usePortalStore((s) => s.links);
  const notices = usePortalStore((s) => s.notices);
  const alcoholChecks = usePortalStore((s) => s.alcoholChecks);
  const committees = usePortalStore((s) => s.committees);
  const minutes = usePortalStore((s) => s.minutes);
  const evaluations = usePortalStore((s) => s.evaluations);
  const today = todayString();

  const myLinks = links.filter((l) => !current || l.units.includes(current.unitId));
  const myNotices = sortNotices(notices.filter((n) => noticeVisibleTo(n, current))).slice(0, 4);
  const todayChecks = current ? alcoholChecksFor(alcoholChecks, current.id, today) : { before: undefined, after: undefined };

  const committeeAlerts = useMemo(
    () =>
      committeeStatuses(committees, minutes).filter(
        (s) =>
          (s.state === "overdue" || s.state === "soon" || s.state === "never") &&
          (!current || s.committee.units.includes(current.unitId))
      ),
    [committees, minutes, current]
  );

  const myEvalTodos = current
    ? evaluations.filter(
        (e) =>
          (e.staffId === current.id && e.status === "draft") ||
          (e.evaluatorId === current.id && e.status === "selfDone")
      )
    : [];

  return (
    <PageContainer>
      <div className="rounded-2xl bg-gradient-to-br from-teal-600 to-teal-800 p-5 text-white shadow-sm sm:p-7">
        <p className="text-xs font-semibold text-teal-100">{formatDate(today)}</p>
        <h1 className="mt-1 text-xl font-bold sm:text-2xl">
          {current ? `${current.name} さん、お疲れさまです` : "株式会社Uchi care 社内ポータル"}
        </h1>
        {current && (
          <p className="mt-1 flex items-center gap-2 text-sm text-teal-50">
            所属: {unitName(current.unitId)} / {current.role}
          </p>
        )}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {current?.isDriver && (
          <Card>
            <h2 className="text-sm font-bold text-slate-900">🌬️ 今日のアルコールチェック</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(["before", "after"] as const).map((t) => {
                const c = todayChecks[t];
                return (
                  <div key={t} className="rounded-lg bg-slate-50 p-3 text-center">
                    <p className="text-[11px] font-semibold text-slate-500">{t === "before" ? "運転前" : "運転後"}</p>
                    {c ? (
                      <p className={`mt-1 text-sm font-bold ${c.value > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                        {c.value > 0 ? "⚠ 検知あり" : "✓ 記録済"}
                        <span className="block text-[11px] font-normal text-slate-500">{c.time}</span>
                      </p>
                    ) : (
                      <p className="mt-1 text-sm font-bold text-amber-600">未記録</p>
                    )}
                  </div>
                );
              })}
            </div>
            <Link href="/portal/alcohol-check" className={`${buttonClass.primary} mt-3 w-full`}>
              記録する
            </Link>
          </Card>
        )}

        <Card className={current?.isDriver ? "lg:col-span-2" : "lg:col-span-3"}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">📢 社内のお知らせ</h2>
            <Link href="/portal/notices" className="text-xs font-semibold text-teal-700 hover:underline">
              すべて見る →
            </Link>
          </div>
          {myNotices.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">お知らせはありません。</p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-100">
              {myNotices.map((n) => {
                const unread = current && !n.readBy.includes(current.id);
                return (
                  <li key={n.id}>
                    <Link href={`/portal/notices?id=${n.id}`} className="flex items-start gap-2 py-2.5 hover:bg-slate-50">
                      {unread ? (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-rose-500" />
                      ) : (
                        <span className="mt-1.5 h-2 w-2 shrink-0" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          {n.pinned && <span className="text-xs">📌</span>}
                          {n.category === "重要" && <StatusPill tone="danger">重要</StatusPill>}
                          <span className={`text-sm ${unread ? "font-bold text-slate-900" : "text-slate-700"}`}>
                            {n.title}
                          </span>
                        </span>
                        <span className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400">
                          {formatDateTime(n.createdAt)} <UnitBadges units={n.units} />
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {(committeeAlerts.length > 0 || myEvalTodos.length > 0) && (
        <Card className="mt-4">
          <h2 className="text-sm font-bold text-slate-900">✅ やることリスト</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {myEvalTodos.map((e) => (
              <li key={e.id} className="flex items-center gap-2">
                <StatusPill tone="info">人事評価</StatusPill>
                <Link href={`/portal/evaluations?id=${e.id}`} className="text-slate-700 hover:text-teal-700 hover:underline">
                  {e.period}:{e.staffId === current?.id ? "自己評価を入力してください" : "評価者評価を入力してください"}
                </Link>
              </li>
            ))}
            {committeeAlerts.map((s) => (
              <li key={s.committee.id} className="flex flex-wrap items-center gap-2">
                <StatusPill tone={s.state === "soon" ? "warn" : "danger"}>
                  {s.state === "overdue" ? "開催期限超過" : s.state === "soon" ? "開催期限間近" : "開催記録なし"}
                </StatusPill>
                <Link href="/portal/minutes" className="text-slate-700 hover:text-teal-700 hover:underline">
                  {s.committee.name}
                </Link>
                {s.nextDue && <span className="text-xs text-slate-400">期限目安 {formatDate(s.nextDue)}</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
            🔗 よく使うシステム {current && <UnitBadge unitId={current.unitId} />}
          </h2>
          <Link href="/portal/links" className="text-xs font-semibold text-teal-700 hover:underline">
            すべてのシステム →
          </Link>
        </div>
        <LinkGrid links={myLinks} compact />
      </section>

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { href: "/portal/vehicle-log", icon: "🚗", label: "運行管理表" },
          { href: "/portal/minutes", icon: "🗂️", label: "委員会議事録" },
          { href: "/portal/evaluations", icon: "⭐", label: "人事評価" },
          { href: "/portal/settings", icon: "⚙️", label: "設定・マスタ" },
        ].map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="flex flex-col items-center gap-1 rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700 shadow-sm hover:border-teal-400 hover:text-teal-700"
          >
            <span className="text-2xl">{m.icon}</span>
            {m.label}
          </Link>
        ))}
      </section>
    </PageContainer>
  );
}
