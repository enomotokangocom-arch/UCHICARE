import type { Metadata } from "next";
import { requireUser } from "@/mos/server/auth";
import { closeMonthAction, reopenMonthAction } from "@/mos/server/actions";
import { getDb } from "@/mos/server/db";
import { heldCounts, listSnapshots } from "@/mos/server/queries";
import { ActionForm, inputCls } from "@/mos/ui/ActionForm";
import { StatusBadge } from "@/mos/ui/Badges";
import { Card, PageHeader } from "@/mos/ui/Card";
import { dateTime, yen, ymLabel } from "@/mos/ui/format";

export const metadata: Metadata = { title: "月次確定" };

const ACTION_LABEL: Record<string, string> = {
  MONTH_CLOSED: "確定",
  MONTH_REOPENED: "確定解除",
  HELD_APPLIED: "保留値の反映",
};

export default async function ClosingPage() {
  await requireUser(["ADMIN"]);
  const db = getDb();
  const [snapshots, closes, held, audits] = await Promise.all([
    listSnapshots(db, "REAL"),
    db.monthClose.findMany({ include: { closedBy: { select: { name: true } } } }),
    heldCounts(db),
    db.auditLog.findMany({ where: { action: { in: Object.keys(ACTION_LABEL) } }, orderBy: { at: "desc" }, take: 30, include: { user: { select: { name: true } } } }),
  ]);
  const closeMap = new Map(closes.map((c) => [c.yearMonth, c]));

  return (
    <>
      <PageHeader title="月次確定" description="試算表を取込み照合を終えた月を確定します。確定した月の数値は、取込や再計算で変わりません（新しい値は保留されます）。" />
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="py-1 text-left">月</th>
                <th className="text-left">状態</th>
                <th className="text-right">全社売上</th>
                <th className="text-right">営業利益</th>
                <th className="text-right">未照合差額</th>
                <th className="text-right">保留</th>
                <th className="text-left">操作</th>
              </tr>
            </thead>
            <tbody>
              {[...snapshots].reverse().map((s) => {
                const c = closeMap.get(s.yearMonth);
                const closed = c?.status === "CLOSED";
                const pl = s.data.pl;
                return (
                  <tr key={s.yearMonth} className="border-t border-slate-100 align-top">
                    <td className="py-2">{ymLabel(s.yearMonth)}</td>
                    <td>
                      <StatusBadge status={pl.status} />
                      {closed && <div className="mt-1 text-xs text-slate-500">{dateTime(c?.closedAt)}・{c?.closedBy?.name}</div>}
                    </td>
                    <td className="text-right tabular-nums">{yen(pl.company.revenue)}</td>
                    <td className="text-right tabular-nums">{yen(pl.company.operatingProfit)}</td>
                    <td className="text-right tabular-nums">{pl.basis === "TRIAL_BALANCE" ? yen(pl.reconciliation.unreconciledAmount) : "—"}</td>
                    <td className="text-right">{held.get(s.yearMonth) ?? 0}</td>
                    <td>
                      {closed ? (
                        <ActionForm action={reopenMonthAction} submitLabel="確定を解除" confirm="確定を解除すると、この月の数値が再計算で変わる可能性があります。よろしいですか？">
                          <input type="hidden" name="yearMonth" value={s.yearMonth} />
                          <input name="reason" required placeholder="解除の理由（必須）" className={`${inputCls} w-56`} />
                        </ActionForm>
                      ) : pl.basis === "TRIAL_BALANCE" ? (
                        <ActionForm
                          action={closeMonthAction}
                          submitLabel="この月を確定"
                          confirm={pl.reconciliation.unreconciledAmount ? `未照合差額 ${pl.reconciliation.unreconciledAmount.toLocaleString()}円 があります。確定しますか？` : "この月を確定します。よろしいですか？"}
                        >
                          <input type="hidden" name="yearMonth" value={s.yearMonth} />
                        </ActionForm>
                      ) : (
                        <span className="text-xs text-slate-500">試算表の取込後に確定できます</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="mt-4">
        <Card title="確定・解除の履歴">
          <ul className="space-y-1 text-sm">
            {audits.map((a) => (
              <li key={a.id}>
                {dateTime(a.at)} {a.user?.name ?? "—"}: {a.target} を{ACTION_LABEL[a.action]}
                {a.action === "MONTH_REOPENED" && (a.detail as { reason?: string } | null)?.reason && `（理由: ${(a.detail as { reason: string }).reason}）`}
              </li>
            ))}
            {audits.length === 0 && <li className="text-slate-500">履歴はありません</li>}
          </ul>
        </Card>
      </div>
    </>
  );
}
