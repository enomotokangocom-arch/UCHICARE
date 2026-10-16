import type { Metadata } from "next";
import { requireUser } from "@/mos/server/auth";
import { applyHeldAction } from "@/mos/server/actions";
import { getDb } from "@/mos/server/db";
import { listSnapshots, originFromParam } from "@/mos/server/queries";
import { UNIT_LABEL } from "@/mos/domain/types";
import { ActionForm } from "@/mos/ui/ActionForm";
import { SampleBanner, StatusBadge } from "@/mos/ui/Badges";
import { Card, Notice, PageHeader } from "@/mos/ui/Card";
import { MonthPicker } from "@/mos/ui/MonthPicker";
import { dateTime, yen, ymLabel } from "@/mos/ui/format";

export const metadata: Metadata = { title: "試算表との照合" };

const SEGMENT = { COMPANY: "全社", HOMONKANGO: "訪問看護", KYOTAKU: "居宅支援", HQ: "本部" } as const;

export default async function ReconciliationPage(props: PageProps<"/mos/reconciliation">) {
  const user = await requireUser(["ADMIN", "MANAGER"]);
  const sp = await props.searchParams;
  const origin = originFromParam(sp.data);
  const db = getDb();
  const snapshots = await listSnapshots(db, origin);
  if (snapshots.length === 0) {
    return (
      <>
        <PageHeader title="試算表との照合" />
        <Notice>データがありません。</Notice>
      </>
    );
  }
  const selected = snapshots.find((s) => s.yearMonth === sp.ym) ?? snapshots[snapshots.length - 1];
  const ym = selected.yearMonth;
  const pl = selected.data.pl;
  const [bankByTitle, heldFacts, heldTb, close] = await Promise.all([
    db.bankTransaction.groupBy({ by: ["accountTitle"], where: { origin, yearMonth: ym, category: { in: ["EXPENSE", "PAYROLL"] }, accountTitle: { not: null } }, _sum: { withdrawal: true, deposit: true } }),
    db.revenueFact.findMany({ where: { origin, yearMonth: ym, state: "HELD" }, include: { batch: { select: { fileName: true, createdAt: true } } } }),
    db.trialBalanceLine.findMany({ where: { origin, yearMonth: ym, state: "HELD" }, include: { batch: { select: { fileName: true, createdAt: true } } } }),
    db.monthClose.findUnique({ where: { yearMonth: ym } }),
  ]);
  const activeTb = heldTb.length
    ? await db.trialBalanceLine.findMany({ where: { origin, yearMonth: ym, state: "ACTIVE" } })
    : [];
  const heldTbDiffs = heldTb
    .map((h) => {
      const cur = activeTb.find((a) => a.segment === h.segment && a.accountName === h.accountName);
      return { ...h, current: cur?.amount ?? null };
    })
    .filter((h) => h.current !== h.amount);
  const isClosed = origin === "REAL" && close?.status === "CLOSED";
  const companyByAccount = new Map(pl.company.expenses.map((e) => [e.accountName, e.amount]));

  return (
    <>
      <PageHeader title="試算表との照合" description={`${ymLabel(ym)}・未照合差額 ${yen(pl.reconciliation.unreconciledAmount)}`}>
        <MonthPicker months={snapshots.map((s) => s.yearMonth)} value={ym} />
      </PageHeader>
      <SampleBanner origin={origin} />
      {pl.basis !== "TRIAL_BALANCE" && (
        <div className="mb-4">
          <Notice tone="warn">この月の試算表は未取込のため、売上・費用は推計値です。試算表を取込むと照合できます。</Notice>
        </div>
      )}

      <Card title="売上の照合（業務データ ↔ 試算表）">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="py-1 text-left">部門</th>
                <th className="text-left">試算表の科目</th>
                <th className="text-right">業務データ</th>
                <th className="text-right">試算表</th>
                <th className="text-right">差額</th>
                <th className="text-right">状態</th>
              </tr>
            </thead>
            <tbody>
              {pl.reconciliation.revenue.map((r) => (
                <tr key={r.unit} className="border-t border-slate-100">
                  <td className="py-1.5">{UNIT_LABEL[r.unit]}</td>
                  <td>{r.accountName}</td>
                  <td className="text-right tabular-nums">{r.operational === null ? "未取込" : yen(r.operational)}</td>
                  <td className="text-right tabular-nums">{r.trialBalance === null ? "未取込" : yen(r.trialBalance)}</td>
                  <td className={`text-right tabular-nums ${r.diff && !r.matched ? "font-semibold text-red-700" : ""}`}>{r.diff === null ? "—" : yen(r.diff)}</td>
                  <td className="text-right">
                    <StatusBadge status={pl.units[r.unit].revenueStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">業務データ: 居宅＝居宅売上管理表の総売上、訪問看護＝iBow 月次売上。</p>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="試算表の部門整合性（全社＝訪問看護＋居宅支援）">
          {pl.basis !== "TRIAL_BALANCE" ? (
            <p className="text-sm text-slate-600">試算表未取込</p>
          ) : pl.reconciliation.segmentDiffs.length === 0 ? (
            <p className="text-sm text-emerald-700">✓ すべての科目で一致しています</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="text-left">科目</th>
                  <th className="text-right">全社</th>
                  <th className="text-right">部門合計</th>
                  <th className="text-right">差額</th>
                </tr>
              </thead>
              <tbody>
                {pl.reconciliation.segmentDiffs.map((d) => (
                  <tr key={d.accountName} className="border-t border-slate-100">
                    <td className="py-1">{d.accountName}</td>
                    <td className="text-right tabular-nums">{yen(d.company)}</td>
                    <td className="text-right tabular-nums">{yen(d.units)}</td>
                    <td className="text-right font-semibold tabular-nums text-red-700">{yen(d.diff)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {pl.reconciliation.unknownAccounts.length > 0 && (
            <p className="mt-2 text-sm text-amber-800">科目マスタ未登録: {pl.reconciliation.unknownAccounts.join("、")}</p>
          )}
        </Card>

        <Card title="銀行明細（分類済み）と試算表の比較（参考）">
          {bankByTitle.length === 0 ? (
            <p className="text-sm text-slate-600">この月の分類済み経費はありません。</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="text-left">科目</th>
                  <th className="text-right">銀行明細</th>
                  <th className="text-right">損益計算</th>
                </tr>
              </thead>
              <tbody>
                {bankByTitle.map((b) => (
                  <tr key={b.accountTitle} className="border-t border-slate-100">
                    <td className="py-1">{b.accountTitle}</td>
                    <td className="text-right tabular-nums">{yen((b._sum.withdrawal ?? 0) - (b._sum.deposit ?? 0))}</td>
                    <td className="text-right tabular-nums">{yen(companyByAccount.get(b.accountTitle!) ?? null)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-2 text-xs text-slate-500">支払時期と計上時期のずれ・カード払い・未払計上があるため一致しないことがあります。</p>
        </Card>
      </div>

      <div className="mt-4">
        <Card title="確定月の変更候補（保留中の値）">
          {heldFacts.length === 0 && heldTbDiffs.length === 0 ? (
            <p className="text-sm text-slate-600">保留中の値はありません。</p>
          ) : (
            <>
              <ul className="space-y-1 text-sm">
                {heldFacts.map((f) => (
                  <li key={f.id}>
                    {UNIT_LABEL[f.unit]} 売上（{f.source === "KYOTAKU_SHEET" ? "居宅売上管理表" : "iBow"}）: 新しい値 {yen(f.amount)}
                    <span className="text-xs text-slate-500">（{f.batch.fileName}・{dateTime(f.batch.createdAt)}）</span>
                  </li>
                ))}
                {heldTbDiffs.map((h) => (
                  <li key={h.id}>
                    試算表 {SEGMENT[h.segment]} {h.accountName}: {yen(h.current)} → {yen(h.amount)}
                    <span className="text-xs text-slate-500">（{h.batch.fileName}）</span>
                  </li>
                ))}
              </ul>
              {isClosed ? (
                <p className="mt-3 text-sm text-slate-600">確定済みの月です。反映するには、月次確定画面で確定を解除してから反映してください。</p>
              ) : user.role === "ADMIN" ? (
                <ActionForm action={applyHeldAction} submitLabel="保留中の値を反映する" className="mt-3" confirm="保留中の値で現在の値を置き換えます。よろしいですか？">
                  <input type="hidden" name="yearMonth" value={ym} />
                </ActionForm>
              ) : (
                <p className="mt-3 text-sm text-slate-600">反映は経営者（管理者）が行います。</p>
              )}
            </>
          )}
        </Card>
      </div>
    </>
  );
}
