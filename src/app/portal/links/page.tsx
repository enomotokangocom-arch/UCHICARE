"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePortalStore, useCurrentStaff } from "@/lib/portal/store";
import { BusinessUnitId, LinkCategory } from "@/lib/portal/types";
import { LinkGrid } from "@/components/portal/LinkGrid";
import { EmptyState, PageContainer, PageHeader, UnitFilter, buttonClass, inputClass } from "@/components/portal/ui";

const CATEGORY_ORDER: LinkCategory[] = [
  "カルテ",
  "スケジュール",
  "勤怠",
  "書類管理",
  "連携・コミュニケーション",
  "名刺",
  "福利厚生",
  "店舗・レジ",
  "デザイン",
  "その他",
];

export default function LinksPage() {
  const links = usePortalStore((s) => s.links);
  const current = useCurrentStaff();
  const [unit, setUnit] = useState<BusinessUnitId | "all">(current?.unitId ?? "all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return links.filter(
      (l) =>
        (unit === "all" || l.units.includes(unit)) &&
        (!q || `${l.name} ${l.description} ${l.category}`.toLowerCase().includes(q))
    );
  }, [links, unit, query]);

  const grouped = CATEGORY_ORDER.map((c) => ({ category: c, items: filtered.filter((l) => l.category === c) })).filter(
    (g) => g.items.length > 0
  );

  return (
    <PageContainer>
      <PageHeader
        icon="🔗"
        title="外部システム"
        description="各事業所で使うシステムへワンタップで移動できます(新しいタブで開きます)。"
        actions={
          <Link href="/portal/settings#links" className={buttonClass.secondary}>
            リンクを編集
          </Link>
        }
      />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <UnitFilter value={unit} onChange={setUnit} />
        <input
          className={`${inputClass} sm:max-w-xs`}
          placeholder="システム名で検索"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {grouped.length === 0 ? (
        <EmptyState>該当するシステムがありません。</EmptyState>
      ) : (
        <div className="space-y-6">
          {grouped.map((g) => (
            <section key={g.category}>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">{g.category}</h2>
              <LinkGrid links={g.items} />
            </section>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
