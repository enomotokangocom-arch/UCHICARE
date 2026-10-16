import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/mos/server/auth";
import { getDb } from "@/mos/server/db";
import { NEEDS_REVIEW_WHERE, originFromParam, reviewStats } from "@/mos/server/queries";
import { TX_CATEGORY_LABEL } from "@/mos/domain/types";
import { SampleBanner } from "@/mos/ui/Badges";
import { Card, PageHeader } from "@/mos/ui/Card";
import { num, yen } from "@/mos/ui/format";
import { ClassifyForm } from "./ClassifyForm";

export const metadata: Metadata = { title: "未分類取引" };

const CLASSIFIED_BY = { RULE: "ルール", MANUAL: "手動", TRANSFER_MATCH: "振替照合", NONE: "—" } as const;

export default async function TransactionsPage(props: PageProps<"/mos/transactions">) {
  await requireUser(["ADMIN", "MANAGER"]);
  const sp = await props.searchParams;
  const origin = originFromParam(sp.data);
  const ym = typeof sp.ym === "string" && /^\d{4}-\d{2}$/.test(sp.ym) ? sp.ym : undefined;
  const showAll = sp.all === "1";
  const db = getDb();
  const [txs, stats, accounts, monthRows, closed] = await Promise.all([
    db.bankTransaction.findMany({
      where: { origin, ...(ym ? { yearMonth: ym } : {}), ...(showAll ? {} : NEEDS_REVIEW_WHERE) },
      include: { account: { select: { label: true, last4: true } } },
      orderBy: [{ txDate: "desc" }, { seq: "asc" }],
      take: 300,
    }),
    reviewStats(db, origin, ym),
    db.accountTitle.findMany({ where: { section: { in: ["SGA", "COGS"] } }, orderBy: { sortOrder: "asc" } }),
    db.bankTransaction.findMany({ where: { origin }, select: { yearMonth: true }, distinct: ["yearMonth"], orderBy: { yearMonth: "desc" } }),
    db.monthClose.findMany({ where: { status: "CLOSED" } }),
  ]);
  const closedSet = new Set(origin === "REAL" ? closed.map((c) => c.yearMonth) : []);
  const q = (p: Record<string, string | undefined>) => {
    const s = new URLSearchParams();
    if (origin === "SAMPLE") s.set("data", "sample");
    for (const [k, v] of Object.entries(p)) if (v) s.set(k, v);
    return `?${s.toString()}`;
  };

  return (
    <>
      <PageHeader title="未分類取引の確認" description="自動分類できなかった取引、科目未設定の経費、税・社会保険料（預り金を含みうるもの）を確認します。分類するまで損益（推計）には計上されません。" />
      <SampleBanner origin={origin} />
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <Link href={q({ all: showAll ? "1" : undefined })} className={`rounded px-2 py-1 ${!ym ? "bg-slate-800 text-white" : "bg-white ring-1 ring-slate-200"}`}>
          全期間
        </Link>
        {monthRows.map((m) => (
          <Link key={m.yearMonth} href={q({ ym: m.yearMonth, all: showAll ? "1" : undefined })} className={`rounded px-2 py-1 ${ym === m.yearMonth ? "bg-slate-800 text-white" : "bg-white ring-1 ring-slate-200"}`}>
            {m.yearMonth}
          </Link>
        ))}
        <span className="mx-2 text-slate-300">|</span>
        <Link href={q({ ym, all: showAll ? undefined : "1" })} className="text-teal-700 underline">
          {showAll ? "要確認のみ表示" : "分類済みも表示"}
        </Link>
      </div>
      <Card title={`要確認 ${num(stats.count)}件・${yen(stats.amount)}`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="whitespace-nowrap text-xs text-slate-500">
              <tr>
                <th className="py-1 text-left">日付</th>
                <th className="text-left">口座</th>
                <th className="text-left">摘要・メモ</th>
                <th className="text-right">入金</th>
                <th className="text-right">出金</th>
                <th className="text-left">現在の分類</th>
                <th className="text-left">分類を変更</th>
              </tr>
            </thead>
            <tbody>
              {txs.map((t) => (
                <tr key={t.id} className="border-t border-slate-100 align-top">
                  <td className="py-2 whitespace-nowrap text-xs">{t.txDate.toISOString().slice(0, 10)}</td>
                  <td className="text-xs">
                    {t.account.label}
                    <span className="text-slate-400"> …{t.account.last4}</span>
                  </td>
                  <td className="max-w-[260px]">
                    <div className="break-words">{t.description}</div>
                    {t.memo && <div className="text-xs text-slate-500">メモ: {t.memo}</div>}
                  </td>
                  <td className="whitespace-nowrap px-2 text-right tabular-nums">{t.deposit ? yen(t.deposit) : ""}</td>
                  <td className="whitespace-nowrap px-2 text-right tabular-nums">{t.withdrawal ? yen(t.withdrawal) : ""}</td>
                  <td className="min-w-[110px] px-2 text-xs">
                    {TX_CATEGORY_LABEL[t.category]}
                    {t.accountTitle && `・${t.accountTitle}`}
                    <div className="text-slate-400">{CLASSIFIED_BY[t.classifiedBy]}</div>
                  </td>
                  <td>
                    {closedSet.has(t.yearMonth) ? (
                      <span className="text-xs text-slate-500">確定済みの月</span>
                    ) : (
                      <ClassifyForm id={t.id} category={t.category} accountTitle={t.accountTitle} unit={t.unit} accounts={accounts.map((a) => a.name)} />
                    )}
                  </td>
                </tr>
              ))}
              {txs.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-500">
                    要確認の取引はありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {txs.length === 300 && <p className="mt-2 text-xs text-slate-500">最初の300件を表示しています。月で絞り込んでください。</p>}
      </Card>
    </>
  );
}
