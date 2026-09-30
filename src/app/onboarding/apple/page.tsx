"use client";

import Link from "next/link";
import { useState } from "react";
import { api, fmtDate, useApi } from "@/onboarding/ui/client";
import { useMe } from "@/onboarding/ui/me";
import { Alert, Button, Card, Empty, inputCls, PageTitle, Tag, useAction } from "@/onboarding/ui/kit";
import { APPLE_STATUS_LABELS, AppleStatus, pad3 } from "@/onboarding/shared/labels";

type Row = {
  id: number; number: number; planned_email: string; actual_email: string | null; status: string; hire_id: number | null; hire_name: string | null;
  reserved_by_name: string | null; reserved_at: string; failure_reason: string | null; cancel_reason: string | null; note: string | null;
  reuse_approved_by_name: string | null; reuse_approved_at: string | null;
};
type List = { next: number; nextEmail: string; lastIssued: number; rows: Row[] };
type Dash = { hires: { id: number; name: string; apple_status: string | null }[] };

export default function ApplePage() {
  const me = useMe();
  const { data, error, reload } = useApi<List>("/apple");
  const { data: dash } = useApi<Dash>("/dashboard");
  const { run, busy, msg } = useAction();
  const [reuse, setReuse] = useState<Record<number, { hire_id: string; note: string }>>({});
  const [unusable, setUnusable] = useState<Record<number, string>>({});
  const tones: Record<string, "amber" | "teal" | "slate" | "rose"> = { reserved: "amber", created: "teal", cancelled: "slate", unusable: "rose" };
  const hiresWithout = dash?.hires.filter((h) => !h.apple_status) ?? [];

  return (
    <div className="space-y-5">
      <PageTitle sub="番号は3桁で管理し、重複しないよう自動で採番します。番号予約は入職者詳細の「Appleアカウント」欄から行います。">Appleアカウント番号</PageTitle>
      {error && <Alert tone="error">{error}</Alert>}
      {msg}
      {data && (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <Card><p className="text-xs text-slate-500">発行済みの最新番号(設定値)</p><p className="text-2xl font-bold">{pad3(data.lastIssued)}</p></Card>
            <Card><p className="text-xs text-slate-500">次に予約される番号</p><p className="text-2xl font-bold">{pad3(data.next)}</p><p className="text-sm">{data.nextEmail}</p></Card>
            <Card>
              <p className="text-xs text-slate-500">取消番号の扱い</p>
              <p className="text-xs">取消した番号は自動では使われません。Apple側で未作成であることを確認したうえで、管理者が「再利用を承認」した場合のみ別の入職者に割り当てます。使用不可の番号は再利用できません。</p>
            </Card>
          </div>
          <Card title="番号一覧">
            {data.rows.length === 0 ? <Empty>まだ予約された番号はありません。</Empty> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="border-b text-left text-xs text-slate-500"><tr><th className="py-2">番号</th><th>予定メール</th><th>実際に作成したメール</th><th>状態</th><th>割り当て職員</th><th>予約者・日時</th><th>理由・メモ</th>{me.actor.role === "admin" && <th>管理者の操作</th>}</tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.rows.map((r) => (
                      <tr key={r.id} className="align-top">
                        <td className="py-2 text-lg font-bold tabular-nums">{pad3(r.number)}</td>
                        <td>{r.planned_email}</td>
                        <td>{r.actual_email ?? <span className="text-slate-400">—</span>}</td>
                        <td><Tag tone={tones[r.status]}>{APPLE_STATUS_LABELS[r.status as AppleStatus]}</Tag></td>
                        <td>{r.hire_id ? <Link className="text-teal-700 hover:underline" href={`/onboarding/hires/${r.hire_id}`}>{r.hire_name}</Link> : "—"}</td>
                        <td className="text-xs">{r.reserved_by_name}<div className="text-slate-500">{fmtDate(r.reserved_at)}</div></td>
                        <td className="text-xs">
                          {r.failure_reason && <div>作成不可: {r.failure_reason}</div>}
                          {r.cancel_reason && <div>取消: {r.cancel_reason}</div>}
                          {r.reuse_approved_at && <div>再利用承認: {fmtDate(r.reuse_approved_at)} {r.reuse_approved_by_name}</div>}
                          {r.note && <div>{r.note}</div>}
                        </td>
                        {me.actor.role === "admin" && (
                          <td className="text-xs">
                            {r.status === "cancelled" && !r.actual_email && (
                              <div className="space-y-1">
                                <select className={inputCls} value={reuse[r.id]?.hire_id ?? ""} onChange={(e) => setReuse({ ...reuse, [r.id]: { hire_id: e.target.value, note: reuse[r.id]?.note ?? "" } })}>
                                  <option value="">再利用先の入職者</option>
                                  {hiresWithout.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                                </select>
                                <input className={inputCls} placeholder="判断理由(Apple側で未作成を確認 等)" value={reuse[r.id]?.note ?? ""} onChange={(e) => setReuse({ ...reuse, [r.id]: { hire_id: reuse[r.id]?.hire_id ?? "", note: e.target.value } })} />
                                <div className="flex gap-1">
                                  <Button size="sm" disabled={busy || !reuse[r.id]?.hire_id} onClick={() => run(() => api(`/apple/${r.id}`, { method: "POST", body: { action: "reuse", ...reuse[r.id] } }).then(reload), "再利用を承認しました。")}>再利用を承認</Button>
                                </div>
                                <div className="flex gap-1">
                                  <input className={inputCls} placeholder="使用不可の理由" value={unusable[r.id] ?? ""} onChange={(e) => setUnusable({ ...unusable, [r.id]: e.target.value })} />
                                  <Button size="sm" variant="danger" disabled={busy} onClick={() => run(() => api(`/apple/${r.id}`, { method: "POST", body: { action: "unusable", reason: unusable[r.id] } }).then(reload))}>使用不可</Button>
                                </div>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
