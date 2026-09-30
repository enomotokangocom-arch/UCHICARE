"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { fmtDate, Options, todayLocal, useApi } from "@/onboarding/ui/client";
import { useMe } from "@/onboarding/ui/me";
import { Alert, Button, Card, Empty, HireBadge, inputCls, PageTitle, Progress, TaskBadge, Tag } from "@/onboarding/ui/kit";
import { HIRE_STATUS_LABELS } from "@/onboarding/shared/labels";
import { goTo, isBrowserDemo } from "@/onboarding/ui/nav";

type Hire = {
  id: number; name: string; name_romaji: string; start_date: string; prep_deadline: string; status: string;
  department_name: string; office_name: string | null; job_type_name: string | null; preparer_name: string | null;
  apple_email: string | null; apple_status: string | null;
  progress: { required_total: number; required_done: number; required_rate: number; optional_total: number; optional_done: number; overdue: number; counts: Record<string, number> };
};
type Row = { hire_id: number; hire_name: string; title: string; due_date: string | null; status: string; assignee_name?: string; kind?: string };
type Dash = { hires: Hire[]; counts: Record<string, number>; overdueTasks: Row[]; enomotoTasks: Row[]; statusCounts: Record<string, number> };

export default function Dashboard() {
  const me = useMe();
  const [f, setF] = useState({ hire_id: "", department_id: "", office_id: "", assignee_id: "", status: "" });
  const qs = useMemo(() => new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString(), [f]);
  const { data, error } = useApi<Dash>(`/dashboard?${qs}`);
  const all = useApi<Dash>("/dashboard");
  const { data: opts } = useApi<Options>("/options");
  const today = todayLocal();

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="space-y-5">
      <PageTitle
        sub="入職予定者ごとの準備状況・期限超過・榎本の対応が必要な作業を確認できます。"
        actions={
          <>
            {!isBrowserDemo() && (
              <Button variant="secondary" onClick={() => goTo("/api/onboarding/export/progress")}>
                進捗CSVを出力(認証情報なし)
              </Button>
            )}
            {me.actor.role === "admin" && (
              <Link href="/onboarding/hires/new" className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">
                + 入職者を登録
              </Link>
            )}
          </>
        }
      >
        ダッシュボード
      </PageTitle>

      <Card>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <label className="text-xs font-semibold text-slate-600">入職者
            <select className={inputCls} value={f.hire_id} onChange={set("hire_id")}>
              <option value="">すべて</option>
              {all.data?.hires.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">部門
            <select className={inputCls} value={f.department_id} onChange={set("department_id")}>
              <option value="">すべて</option>
              {opts?.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">事業所
            <select className={inputCls} value={f.office_id} onChange={set("office_id")}>
              <option value="">すべて</option>
              {opts?.offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">担当者
            <select className={inputCls} value={f.assignee_id} onChange={set("assignee_id")}>
              <option value="">すべて</option>
              {opts?.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">状態
            <select className={inputCls} value={f.status} onChange={set("status")}>
              <option value="">すべて</option>
              {Object.entries(HIRE_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
        </div>
      </Card>

      {error && <Alert tone="error">{error}</Alert>}
      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
            {(["todo", "doing", "waiting_issue", "waiting_check"] as const).map((k) => (
              <div key={k} className="rounded-xl border border-slate-200 bg-white p-3">
                <TaskBadge status={k} />
                <p className="mt-2 text-2xl font-bold tabular-nums">{data.counts[k]}</p>
                <p className="text-[11px] text-slate-500">作業の件数</p>
              </div>
            ))}
            {(["preparing", "ready", "confirmed", "lent"] as const).map((k) => (
              <div key={k} className="rounded-xl border border-slate-200 bg-white p-3">
                <HireBadge status={k} />
                <p className="mt-2 text-2xl font-bold tabular-nums">{data.statusCounts[k] ?? 0}</p>
                <p className="text-[11px] text-slate-500">入職者の人数</p>
              </div>
            ))}
          </div>

          <Card title={`入職予定者(${data.hires.length}名)`}>
            {data.hires.length === 0 ? (
              <Empty>表示できる入職者がいません。</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="border-b border-slate-200 text-left text-xs text-slate-500">
                    <tr>
                      <th className="py-2 pr-2">氏名</th><th className="pr-2">入社日</th><th className="pr-2">部門・事業所</th>
                      <th className="pr-2">準備担当者</th><th className="pr-2">必須作業の完了率</th><th className="pr-2">任意</th>
                      <th className="pr-2">期限超過</th><th className="pr-2">Appleメール</th><th>状態</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.hires.map((h) => (
                      <tr key={h.id} className="hover:bg-slate-50">
                        <td className="py-2.5 pr-2">
                          <Link href={`/onboarding/hires/${h.id}`} className="font-semibold text-teal-700 hover:underline">{h.name}</Link>
                          <div className="text-[11px] text-slate-500">{h.name_romaji}・{h.job_type_name ?? "職種未設定"}</div>
                        </td>
                        <td className="pr-2">
                          {fmtDate(h.start_date)}
                          <div className="text-[11px] text-slate-500">準備期限 {fmtDate(h.prep_deadline)}</div>
                        </td>
                        <td className="pr-2">{h.department_name}<div className="text-[11px] text-slate-500">{h.office_name ?? "事業所未設定"}</div></td>
                        <td className="pr-2">{h.preparer_name ?? <Tag tone="amber">未設定</Tag>}</td>
                        <td className="pr-2">
                          <Progress value={h.progress.required_rate} />
                          <div className="text-[11px] text-slate-500">{h.progress.required_done}/{h.progress.required_total}件</div>
                        </td>
                        <td className="pr-2 text-xs text-slate-600">{h.progress.optional_total ? `${h.progress.optional_done}/${h.progress.optional_total}` : "—"}</td>
                        <td className="pr-2">{h.progress.overdue ? <Tag tone="rose">{h.progress.overdue}件</Tag> : <span className="text-xs text-slate-400">なし</span>}</td>
                        <td className="pr-2 text-xs">
                          {h.apple_email ? (
                            <>
                              {h.apple_email}
                              <div>{h.apple_status === "created" ? <Tag tone="teal">作成済み</Tag> : <Tag tone="amber">予約中</Tag>}</div>
                            </>
                          ) : <span className="text-slate-400">未予約</span>}
                        </td>
                        <td><HireBadge status={h.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card title={`期限超過の作業(${data.overdueTasks.length}件)`}>
              {data.overdueTasks.length === 0 ? <Empty>期限を過ぎた作業はありません。</Empty> : (
                <ul className="divide-y divide-slate-100 text-sm">
                  {data.overdueTasks.map((t, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 py-2">
                      <div>
                        <Link href={`/onboarding/hires/${t.hire_id}`} className="font-semibold text-teal-700 hover:underline">{t.hire_name}</Link>
                        <span className="ml-2">{t.title}</span>
                        <div className="text-[11px] text-slate-500">担当: {t.assignee_name ?? "未設定"}</div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-semibold text-rose-700">期限 {fmtDate(t.due_date)}</span>
                        <div><TaskBadge status={t.status} /></div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title={`榎本の対応が必要な作業(${data.enomotoTasks.length}件)`}>
              <p className="mb-2 text-xs text-slate-500">
                代表(榎本)に割り当てられた作業と、発行権限がまだ移管されていないサービス(eNursing等)の発行です。移管が済んだら管理設定でサービスの担当区分を「移管済み」に変更してください。
              </p>
              {data.enomotoTasks.length === 0 ? <Empty>榎本への依頼が必要な作業はありません。</Empty> : (
                <ul className="divide-y divide-slate-100 text-sm">
                  {data.enomotoTasks.map((t, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 py-2">
                      <div>
                        <Link href={`/onboarding/hires/${t.hire_id}`} className="font-semibold text-teal-700 hover:underline">{t.hire_name}</Link>
                        <span className="ml-2">{t.title}</span>
                      </div>
                      <span className={t.due_date && t.due_date < today ? "text-xs font-semibold text-rose-700" : "text-xs text-slate-500"}>
                        {t.due_date ? `期限 ${fmtDate(t.due_date)}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
