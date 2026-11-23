"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePortalStore, useCurrentStaff } from "@/lib/portal/store";
import { unitName } from "@/lib/portal/defaults";
import { alcoholChecksFor, committeeStatuses, noticeVisibleTo, parkingContractAlerts, sortNotices, vehicleAlerts } from "@/lib/portal/logic";
import { daysAgo, formatDate, formatDateTime, todayString } from "@/lib/portal/util";
import { LinkGrid } from "@/components/portal/LinkGrid";
import { isAdmin } from "@/lib/portal/logic";
import { HomeGoalCards } from "@/components/portal/HomeGoalCards";
import { BrandHero } from "@/components/portal/BrandHero";
import { TodayVehicleCard } from "@/components/portal/TodayVehicleCard";
import { Card, PageContainer, StatusPill, UnitBadge, UnitBadges, buttonClass } from "@/components/portal/ui";

export default function PortalHome() {
  const current = useCurrentStaff();
  const links = usePortalStore((s) => s.links);
  const notices = usePortalStore((s) => s.notices);
  const alcoholChecks = usePortalStore((s) => s.alcoholChecks);
  const committees = usePortalStore((s) => s.committees);
  const minutes = usePortalStore((s) => s.minutes);
  const evaluations = usePortalStore((s) => s.evaluations);
  const parkingLots = usePortalStore((s) => s.parkingLots);
  const vehicles = usePortalStore((s) => s.vehicles);
  const dailySales = usePortalStore((s) => s.dailySales);
  const philosophy = usePortalStore((s) => s.philosophy);
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

  const parkingAlerts = parkingContractAlerts(parkingLots);
  // 売上データの取り込み忘れ(一度でも取り込んだことがあり、前日分まで入っていない場合)
  const latestSalesDate = dailySales.map((d) => d.date).sort().at(-1);
  const salesImportDue = isAdmin(current) && !!latestSalesDate && latestSalesDate < daysAgo(1);
  const carAlerts = vehicleAlerts(vehicles).filter((a) => !current || isAdmin(current) || a.vehicle.unitId === current.unitId);

  const values = philosophy.values
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean);

  return (
    <PageContainer>
      <BrandHero>
        <p className="text-xs font-semibold tracking-wide text-gold-300">{formatDate(today)}</p>
        <h1 className="mt-1 text-xl font-bold sm:text-2xl">
          {current ? `${current.name} さん、お疲れさまです` : "株式会社Uchi care 社内ポータル"}
        </h1>
        {current && (
          <p className="mt-1 text-sm text-brand-100">
            所属: {unitName(current.unitId)} / {current.role} / {current.position}
          </p>
        )}
        <dl className="mt-5 space-y-2 border-t border-white/15 pt-4 text-sm">
          {philosophy.mission && (
            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
              <dt className="w-20 shrink-0 text-[11px] font-bold tracking-[0.2em] text-gold-300">MISSION</dt>
              <dd className="font-semibold">
                {philosophy.mission}
                {philosophy.missionEn && <span className="ml-2 text-xs font-normal text-brand-200">{philosophy.missionEn}</span>}
              </dd>
            </div>
          )}
          {philosophy.vision && (
            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
              <dt className="w-20 shrink-0 text-[11px] font-bold tracking-[0.2em] text-gold-300">VISION</dt>
              <dd className="font-semibold">
                {philosophy.vision}
                {philosophy.visionEn && <span className="ml-2 text-xs font-normal text-brand-200">{philosophy.visionEn}</span>}
              </dd>
            </div>
          )}
          {values.length > 0 && (
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
              <dt className="w-20 shrink-0 text-[11px] font-bold tracking-[0.2em] text-gold-300">VALUES</dt>
              <dd className="flex flex-wrap gap-1.5">
                {values.map((v) => (
                  <span key={v} className="rounded-full border border-gold-300/60 px-2.5 py-0.5 text-xs font-semibold text-white">
                    {v}
                  </span>
                ))}
              </dd>
            </div>
          )}
        </dl>
        <Link href="/portal/philosophy" className="mt-3 inline-block text-xs font-semibold text-gold-300 hover:text-gold-200 hover:underline">
          理念をくわしく見る(理念ブック) →
        </Link>
      </BrandHero>

      {current?.isDriver ? (
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
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
          <TodayVehicleCard />
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Link href="/portal/alcohol-check" className={`${buttonClass.secondary} py-3`}>
            🌬️ アルコールチェック
          </Link>
          <Link href="/portal/vehicle-log" className={`${buttonClass.secondary} py-3`}>
            🚗 運行管理表
          </Link>
        </div>
      )}

      <div className="mt-4">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">📢 社内のお知らせ</h2>
            <Link href="/portal/notices" className="text-xs font-semibold text-brand-700 hover:underline">
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

      <HomeGoalCards />

      {(committeeAlerts.length > 0 || myEvalTodos.length > 0 || parkingAlerts.length > 0 || carAlerts.length > 0 || salesImportDue) && (
        <Card className="mt-4">
          <h2 className="text-sm font-bold text-slate-900">✅ やることリスト</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {myEvalTodos.map((e) => (
              <li key={e.id} className="flex items-center gap-2">
                <StatusPill tone="info">人事評価</StatusPill>
                <Link href={`/portal/evaluations?id=${e.id}`} className="text-slate-700 hover:text-brand-700 hover:underline">
                  {e.period}:{e.staffId === current?.id ? "自己評価を入力してください" : "評価者評価を入力してください"}
                </Link>
              </li>
            ))}
            {salesImportDue && latestSalesDate && (
              <li className="flex flex-wrap items-center gap-2">
                <StatusPill tone="warn">売上の取り込み</StatusPill>
                <Link href="/portal/management" className="text-slate-700 hover:text-brand-700 hover:underline">
                  ZEST・iBow の売上データを取り込んでください
                </Link>
                <span className="text-xs text-slate-400">最新 {formatDate(latestSalesDate)} 分まで</span>
              </li>
            )}
            {carAlerts.map((a) => (
              <li key={`${a.vehicle.id}-${a.label}`} className="flex flex-wrap items-center gap-2">
                <StatusPill tone={a.overdue ? "danger" : "warn"}>{a.overdue ? `${a.label} 期限切れ` : `${a.label} 期限が近い`}</StatusPill>
                <Link href="/portal/parking" className="text-slate-700 hover:text-brand-700 hover:underline">
                  {a.vehicle.name}
                </Link>
                <span className="text-xs text-slate-400">期限 {formatDate(a.date)}</span>
              </li>
            ))}
            {parkingAlerts.map(({ lot, overdue }) => (
              <li key={lot.id} className="flex flex-wrap items-center gap-2">
                <StatusPill tone={overdue ? "danger" : "warn"}>{overdue ? "駐車場 契約期限切れ" : "駐車場 契約更新が近い"}</StatusPill>
                <Link href="/portal/parking" className="text-slate-700 hover:text-brand-700 hover:underline">
                  {lot.name}
                </Link>
                <span className="text-xs text-slate-400">期限 {formatDate(lot.contractEnd)}</span>
              </li>
            ))}
            {committeeAlerts.map((s) => (
              <li key={s.committee.id} className="flex flex-wrap items-center gap-2">
                <StatusPill tone={s.state === "soon" ? "warn" : "danger"}>
                  {s.state === "overdue" ? "開催期限超過" : s.state === "soon" ? "開催期限間近" : "開催記録なし"}
                </StatusPill>
                <Link href="/portal/minutes" className="text-slate-700 hover:text-brand-700 hover:underline">
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
          <Link href="/portal/links" className="text-xs font-semibold text-brand-700 hover:underline">
            すべてのシステム →
          </Link>
        </div>
        <LinkGrid links={myLinks} compact />
      </section>

      <section className="mt-8 space-y-4">
        {[
          {
            title: "記録・管理",
            items: [
              { href: "/portal/minutes", icon: "🗂️", label: "委員会議事録" },
              { href: "/portal/nanbyo", icon: "📑", label: "難病 上限管理表" },
              { href: "/portal/sales", icon: "🤝", label: "営業管理表" },
              { href: "/portal/parking", icon: "🚙", label: "車両・駐車場" },
              { href: "/portal/drive", icon: "🗄️", label: "書類フォルダ" },
            ],
          },
          {
            title: "人・組織",
            items: [
              { href: "/portal/consultation", icon: "💬", label: "相談窓口" },
              { href: "/portal/goals", icon: "🎯", label: "目標管理" },
              { href: "/portal/evaluations", icon: "⭐", label: "人事評価" },
              { href: "/portal/philosophy", icon: "🧭", label: "理念(MVV)" },
              { href: "/portal/job-descriptions", icon: "📘", label: "職務記述書" },
            ],
          },
        ].map((g) => (
          <div key={g.title}>
            <h2 className="mb-2 text-xs font-bold tracking-wide text-slate-400">{g.title}</h2>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {g.items.map((m) => (
                <Link
                  key={m.href}
                  href={m.href}
                  className="flex flex-col items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-3 text-center text-xs font-semibold text-slate-700 shadow-sm hover:border-brand-300 hover:text-brand-700"
                >
                  <span className="text-xl">{m.icon}</span>
                  {m.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>
    </PageContainer>
  );
}
