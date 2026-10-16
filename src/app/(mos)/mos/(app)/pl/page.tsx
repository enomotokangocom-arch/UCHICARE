import type { Metadata } from "next";
import { requireUser } from "@/mos/server/auth";
import { getDb } from "@/mos/server/db";
import { listSnapshots, originFromParam } from "@/mos/server/queries";
import { ALLOCATION_LABEL, BEHAVIOR_LABEL, UNIT_LABEL, type BusinessUnit } from "@/mos/domain/types";
import type { UnitPL } from "@/mos/domain/pl";
import { SampleBanner, StatusBadge } from "@/mos/ui/Badges";
import { Card, Notice, PageHeader } from "@/mos/ui/Card";
import { MonthPicker } from "@/mos/ui/MonthPicker";
import { pct, yen, ymLabel } from "@/mos/ui/format";

export const metadata: Metadata = { title: "損益計算" };

const COLS: { key: "COMPANY" | BusinessUnit; label: string }[] = [
  { key: "COMPANY", label: "全社" },
  { key: "HOMONKANGO", label: "訪問看護" },
  { key: "KYOTAKU", label: "居宅支援" },
];

export default async function PLPage(props: PageProps<"/mos/pl">) {
  await requireUser(["ADMIN", "MANAGER"]);
  const sp = await props.searchParams;
  const origin = originFromParam(sp.data);
  const snapshots = await listSnapshots(getDb(), origin);
  if (snapshots.length === 0) {
    return (
      <>
        <PageHeader title="損益計算" />
        <SampleBanner origin={origin} />
        <Notice>データがありません。ファイルを取込んでください。</Notice>
      </>
    );
  }
  const selected = snapshots.find((s) => s.yearMonth === sp.ym) ?? snapshots[snapshots.length - 1];
  const pl = selected.data.pl;
  const units: Record<string, UnitPL> = { COMPANY: pl.company, ...pl.units };

  const rows: { label: string; get: (u: UnitPL) => string; strong?: boolean; indent?: boolean }[] = [
    { label: "売上高", get: (u) => yen(u.revenue), strong: true },
    { label: "直接費", get: (u) => yen(u.directCost), indent: true },
    { label: "貢献利益（売上−直接費）", get: (u) => yen(u.contributionProfit) },
    { label: "共通費（配賦）", get: (u) => yen(u.commonCost), indent: true },
    { label: "本部費（配賦）", get: (u) => yen(u.hqCost), indent: true },
    { label: "営業利益", get: (u) => yen(u.operatingProfit), strong: true },
    { label: "営業利益率", get: (u) => pct(u.operatingMargin) },
    { label: "人件費", get: (u) => yen(u.laborCost), indent: true },
    { label: "固定費", get: (u) => yen(u.fixedCost), indent: true },
    { label: "変動費", get: (u) => yen(u.variableCost), indent: true },
    { label: "人件費率", get: (u) => pct(u.laborRatio) },
  ];
  const accountNames = [...new Set(pl.company.expenses.map((e) => e.accountName))];
  const amountOf = (u: UnitPL, name: string) => u.expenses.filter((e) => e.accountName === name).reduce((s, e) => s + e.amount, 0);

  return (
    <>
      <PageHeader title="損益計算" description={`${ymLabel(selected.yearMonth)}・${pl.basis === "TRIAL_BALANCE" ? "試算表ベース" : pl.basis === "ESTIMATE" ? "推計（業務データ・銀行明細）" : "データなし"}`}>
        <MonthPicker months={snapshots.map((s) => s.yearMonth)} value={selected.yearMonth} />
      </PageHeader>
      <SampleBanner origin={origin} />
      {pl.notes.map((n) => (
        <div key={n} className="mb-2">
          <Notice>{n}</Notice>
        </div>
      ))}

      <Card title="損益（直接費・共通費・本部費）">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-xs text-slate-500">
                <th className="py-1 text-left">項目</th>
                {COLS.map((c) => (
                  <th key={c.key} className="text-right">
                    <div>{c.label}</div>
                    <div className="mt-1">
                      <StatusBadge status={c.key === "COMPANY" ? pl.status : pl.units[c.key].revenueStatus} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className={`border-t border-slate-100 ${r.strong ? "font-semibold" : ""}`}>
                  <td className={`py-1.5 ${r.indent ? "pl-4 text-slate-600" : ""}`}>{r.label}</td>
                  {COLS.map((c) => (
                    <td key={c.key} className="text-right tabular-nums">
                      {r.get(units[c.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          配賦基準: 共通費・本部費とも{pl.pools.shares ? `訪問看護 ${pct(pl.pools.shares.HOMONKANGO / (pl.pools.shares.HOMONKANGO + pl.pools.shares.KYOTAKU))}・居宅支援 ${pct(pl.pools.shares.KYOTAKU / (pl.pools.shares.HOMONKANGO + pl.pools.shares.KYOTAKU))}` : "未確定"}
          （共通費計 {yen(pl.pools.common)}・本部費計 {yen(pl.pools.hq)}）
        </p>
      </Card>

      <div className="mt-4">
        <Card title="科目別の費用">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="py-1 text-left">科目</th>
                  <th className="text-left">区分</th>
                  {COLS.map((c) => (
                    <th key={c.key} className="text-right">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {accountNames.map((name) => {
                  const line = pl.company.expenses.find((e) => e.accountName === name)!;
                  return (
                    <tr key={name} className="border-t border-slate-100">
                      <td className="py-1.5">{name}</td>
                      <td className="text-xs text-slate-600">
                        {ALLOCATION_LABEL[line.allocation]}・{line.behavior ? BEHAVIOR_LABEL[line.behavior] : "区分未設定"}
                      </td>
                      {COLS.map((c) => (
                        <td key={c.key} className="text-right tabular-nums">
                          {yen(amountOf(units[c.key], name))}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {UNIT_LABEL.HOMONKANGO}・{UNIT_LABEL.KYOTAKU}の列は配賦後の金額です。営業外損益（支払利息・雑収入など）は含みません。
          </p>
        </Card>
      </div>
    </>
  );
}
