"use client";

import Link from "next/link";
import { ExternalLink } from "@/lib/portal/types";
import { UnitBadges } from "./ui";

export function LinkCard({ link, compact }: { link: ExternalLink; compact?: boolean }) {
  if (!link.url) {
    return (
      <Link
        href="/portal/settings#links"
        className="flex items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white p-3 text-left hover:border-teal-400"
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
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-400 hover:shadow"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-xl">
        {link.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-sm font-bold text-slate-900 group-hover:text-teal-700">
          <span className="truncate">{link.name}</span>
          <span className="text-xs text-slate-300 group-hover:text-teal-500">↗</span>
        </span>
        <span className="block truncate text-[11px] text-slate-500">{link.description}</span>
        {!compact && (
          <span className="mt-1 block">
            <UnitBadges units={link.units} />
          </span>
        )}
      </span>
    </a>
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
