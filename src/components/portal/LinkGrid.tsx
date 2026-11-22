"use client";

import Link from "next/link";
import { ExternalLink } from "@/lib/portal/types";
import { UnitBadges } from "./ui";

export function LinkCard({ link, compact }: { link: ExternalLink; compact?: boolean }) {
  // Web のURLがなくアプリだけのサービスは、アプリのページを開く
  const href = link.url || link.appUrl || "";
  const appOnly = !link.url && !!link.appUrl;
  if (!href) {
    return (
      <Link
        href="/portal/settings#links"
        className="flex items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white p-3 text-left hover:border-brand-400"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xl grayscale">
          {link.icon}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold text-slate-500">{link.name}</span>
          <span className="block text-[11px] text-amber-600">URL未設定 — タップして登録</span>
        </span>
      </Link>
    );
  }
  return (
    <div className="group relative flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-400 hover:shadow">
      <a href={href} target="_blank" rel="noopener noreferrer" className="absolute inset-0 rounded-xl" aria-label={`${link.name}を開く`} />
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-xl">
        {link.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-sm font-bold text-slate-900 group-hover:text-brand-700">
          <span className="truncate">{link.name}</span>
          <span className="text-xs text-slate-300 group-hover:text-brand-500">↗</span>
        </span>
        <span className="block truncate text-[11px] text-slate-500">
          {appOnly && "📱 アプリ ・ "}
          {link.description}
        </span>
        {!compact && (
          <span className="mt-1 block">
            <UnitBadges units={link.units} />
          </span>
        )}
      </span>
      {link.url && link.appUrl && (
        <a
          href={link.appUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="relative z-10 shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:border-brand-400 hover:text-brand-700"
          title="スマホアプリ(App Store)を開く"
        >
          📱 アプリ
        </a>
      )}
    </div>
  );
}

export function LinkGrid({ links, compact }: { links: ExternalLink[]; compact?: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {links.map((l) => (
        <LinkCard key={l.id} link={l} compact={compact} />
      ))}
    </div>
  );
}
