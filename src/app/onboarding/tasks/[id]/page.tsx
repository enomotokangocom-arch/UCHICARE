"use client";

import Link from "next/link";
import { use, useState } from "react";
import { api, fmtDate, Options, useApi } from "@/onboarding/ui/client";
import { Alert, Button, Card, Check, Field, inputCls, PageTitle, TaskBadge, Tag, Unset, useAction } from "@/onboarding/ui/kit";
import { HistoryDetail } from "@/onboarding/ui/HireSections";
import { ACCOUNT_TYPE_LABELS, AccountType, PLACEMENT_LABELS, Placement, REQUIREMENT_LABELS, Requirement, TASK_STATUS_LABELS, TaskStatus } from "@/onboarding/shared/labels";

type TaskDetail = {
  task: {
    id: number; hire_id: number; title: string; requirement: string; status: string; na_reason: string | null; assignee_id: number | null;
    assignee_name: string | null; due_date: string | null; procedure: string; completion_criteria: string; related_urls: string;
    account_info: string; device_check: string; completion_mode: string; owner_mode: string; template_version: number;
    template_current_version: number | null; template_updated_at: string | null; template_updated_by_name: string | null;
    iphone_checked_at: string | null; iphone_checked_by_name: string | null; ipad_checked_at: string | null; ipad_checked_by_name: string | null;
    completed_at: string | null; completed_by_name: string | null; template_code: string | null;
  };
  hire: { id: number; name: string; name_romaji: string; start_date: string; department_name: string; office_name: string | null };
  prerequisites: { id: number; title: string; status: string }[];
  comments: { id: number; body: string; created_at: string; user_name: string }[];
  apple: { number: number; planned_email: string; actual_email: string | null; status: string } | null;
  services: { id: number; name: string; placement: string; placement_confirmed: number; url: string | null; app_store_url: string | null; account_type: string; account_note: string | null; requirement: string; usage_decision: string | null; credential_ref?: string | null }[];
  history: { at: string; user_name: string; action: string; detail: string | null }[];
  problems: string[];
  companyGoogle: string | null; credentialStore: string | null; wifiName: string | null; namingRule: string | null;
  perms: { canUpdate: boolean; canAdmin: boolean; canEditDue: boolean };
};

const SERVICE_TASKS = ["app_placement", "service_login", "service_verify", "confirm_placement", "issue_request"];

export default function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: d, error, reload } = useApi<TaskDetail>(`/tasks/${id}`);
  const { data: opts } = useApi<Options>("/options");
  const { run, busy, msg } = useAction();
  const [naReason, setNaReason] = useState("");
  const [comment, setComment] = useState("");
  const [steps, setSteps] = useState<Record<number, boolean>>({});

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!d) return <p className="text-sm text-slate-400">読み込み中...</p>;
  const t = d.task;
  const patch = (body: Record<string, unknown>, ok?: string) => run(() => api(`/tasks/${t.id}`, { method: "PATCH", body }).then(reload), ok);
  const closed = t.status === "done" || t.status === "na";
  const lines = t.procedure.split("\n");

  return (
    <div className="space-y-5">
      <div className="text-sm"><Link href={`/onboarding/hires/${d.hire.id}`} className="text-teal-700 hover:underline">← {d.hire.name} の詳細へ戻る</Link></div>
      <PageTitle sub={`${d.hire.name}(${d.hire.name_romaji})/ ${d.hire.department_name} / 入社日 ${fmtDate(d.hire.start_date)}`}>
        {t.title} <TaskBadge status={t.status} />
      </PageTitle>
      {msg}

      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-5">
          <Card title="操作手順">
            {t.template_current_version && t.template_version < t.template_current_version && !closed && (
              <Alert tone="warn">標準手順が更新されています(この作業は第{t.template_version}版)。適用は管理者が「管理設定 › 標準手順」で差分を確認して行います。</Alert>
            )}
            <p className="mb-2 text-[11px] text-slate-500">手順を見ながら進めてください。左のチェックは作業中の目印です(保存されません)。</p>
            <ol className="space-y-1.5">
              {lines.map((line, i) => {
                const isHeading = /^【.*】$/.test(line.trim()) || !/^\s*(\d+\.|※|-|・)/.test(line);
                const isStep = /^\s*\d+\./.test(line);
                return (
                  <li key={i} className={`flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm ${steps[i] ? "bg-emerald-50 text-slate-500 line-through" : isStep ? "bg-slate-50" : ""}`}>
                    {isStep ? <input type="checkbox" className="mt-0.5 h-4 w-4 accent-teal-600" checked={!!steps[i]} onChange={(e) => setSteps({ ...steps, [i]: e.target.checked })} /> : <span className="w-4" />}
                    <span className={isHeading && !isStep ? "font-semibold text-slate-700" : line.trim().startsWith("※") ? "text-amber-800" : ""}>{line}</span>
                  </li>
                );
              })}
            </ol>
          </Card>

          <Card title="完了条件">
            <p className="whitespace-pre-line text-sm">{t.completion_criteria}</p>
            {!closed && d.problems.length > 0 && (
              <div className="mt-3"><Alert tone="warn"><p className="font-semibold">まだ満たしていない条件</p><ul className="mt-1 list-disc pl-5 text-xs">{d.problems.map((p) => <li key={p}>{p}</li>)}</ul></Alert></div>
            )}
            {!closed && d.problems.length === 0 && t.completion_mode === "manual" && <div className="mt-3"><Alert tone="success">完了条件を満たしています。「完了にする」を押してください。</Alert></div>}
          </Card>

          {t.device_check === "both" && (
            <Card title="iPhone・iPad それぞれの確認">
              <div className="grid gap-3 md:grid-cols-2">
                {(["iphone", "ipad"] as const).map((dv) => {
                  const at = dv === "iphone" ? t.iphone_checked_at : t.ipad_checked_at;
                  const by = dv === "iphone" ? t.iphone_checked_by_name : t.ipad_checked_by_name;
                  return (
                    <div key={dv} className={`rounded-lg border p-4 ${at ? "border-emerald-300 bg-emerald-50" : "border-slate-200"}`}>
                      <p className="text-lg font-bold">{dv === "iphone" ? "📱 iPhone" : "📲 iPad"}</p>
                      <div className="mt-2">
                        <Check checked={!!at} disabled={!d.perms.canUpdate || busy || t.status === "done"} onChange={(v) => patch({ action: "device", device: dv, checked: v })} label={at ? "確認済み" : "この端末で確認した"} />
                      </div>
                      {at && <p className="mt-1 text-[11px] text-slate-500">{fmtDate(at)} {by}</p>}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {(SERVICE_TASKS.includes(t.template_code ?? "") || t.related_urls) && (
            <Card title="関連サービスのURL・使用するアカウント" actions={<Link href={`/onboarding/hires/${d.hire.id}#services`} className="text-sm font-semibold text-teal-700 hover:underline">サービス表で記録する →</Link>}>
              {t.related_urls && <p className="mb-2 whitespace-pre-line text-sm">{t.related_urls}</p>}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="border-b text-left text-xs text-slate-500"><tr><th className="py-1.5">サービス</th><th>区分</th><th>配置方式</th><th>URL</th><th>アカウント</th>{d.services.some((s) => "credential_ref" in s) && <th>認証情報の参照先</th>}</tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {d.services.map((s) => (
                      <tr key={s.id}>
                        <td className="py-1.5 font-semibold">{s.name}</td>
                        <td className="text-xs">{REQUIREMENT_LABELS[s.requirement as Requirement]}</td>
                        <td className="text-xs">{s.placement_confirmed ? PLACEMENT_LABELS[s.placement as Placement] : <Unset>未確定</Unset>}</td>
                        <td className="text-xs">
                          {s.url ? <a className="text-teal-700 underline" href={s.url} target="_blank" rel="noreferrer">Web</a> : null}{" "}
                          {s.app_store_url ? <a className="text-teal-700 underline" href={s.app_store_url} target="_blank" rel="noreferrer">App Store</a> : null}
                          {!s.url && !s.app_store_url && <Unset />}
                        </td>
                        <td className="text-xs">{ACCOUNT_TYPE_LABELS[s.account_type as AccountType]}{s.account_type === "company_google" && d.companyGoogle && <div className="text-slate-500">{d.companyGoogle}</div>}</td>
                        {"credential_ref" in s && <td className="text-xs">{s.credential_ref ?? <Unset />}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <Card title="コメント">
            <ul className="mb-3 space-y-2 text-sm">
              {d.comments.length === 0 && <li className="text-xs text-slate-400">コメントはありません。</li>}
              {d.comments.map((c) => (
                <li key={c.id} className="rounded-lg bg-slate-50 px-3 py-2"><p className="whitespace-pre-line">{c.body}</p><p className="mt-1 text-[11px] text-slate-500">{fmtDate(c.created_at)} {c.user_name}</p></li>
              ))}
            </ul>
            {d.perms.canUpdate && (
              <div className="flex gap-2">
                <textarea className={inputCls} rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="進捗・困ったこと・引き継ぎ事項(パスワードは書かないでください)" />
                <Button disabled={busy || !comment.trim()} onClick={() => run(() => api(`/tasks/${t.id}/comments`, { method: "POST", body: { body: comment } }).then(() => { setComment(""); reload(); }))}>投稿</Button>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="状態を変える">
            {t.completion_mode === "system" ? (
              <Alert tone="info">この作業は入職者詳細の「{t.template_code === "lend" ? "貸与を記録" : "管理者確認を記録"}」で自動的に完了します。</Alert>
            ) : d.perms.canUpdate ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {(["todo", "doing", "waiting_issue", "waiting_check"] as TaskStatus[]).map((s) => (
                    <Button key={s} size="sm" variant={t.status === s ? "primary" : "secondary"} disabled={busy} onClick={() => patch({ action: "status", status: s })}>{TASK_STATUS_LABELS[s]}</Button>
                  ))}
                </div>
                <Button className="w-full" disabled={busy || t.status === "done"} onClick={() => patch({ action: "status", status: "done" }, "完了にしました。")}>完了にする</Button>
                <details className="text-sm">
                  <summary className="cursor-pointer text-xs text-slate-500">対象外にする(理由が必要)</summary>
                  <div className="mt-2 space-y-2">
                    <input className={inputCls} placeholder="対象外にする理由" value={naReason} onChange={(e) => setNaReason(e.target.value)} />
                    <Button size="sm" variant="danger" disabled={busy} onClick={() => patch({ action: "status", status: "na", na_reason: naReason })}>対象外にする</Button>
                  </div>
                </details>
              </div>
            ) : <p className="text-xs text-slate-500">この作業を更新する権限がありません。</p>}
            {t.na_reason && <p className="mt-2 text-xs">対象外の理由: {t.na_reason}</p>}
            {t.completed_at && <p className="mt-2 text-xs text-slate-600">完了: {fmtDate(t.completed_at)} {t.completed_by_name}</p>}
          </Card>

          <Card title="担当・期限">
            <div className="space-y-3 text-sm">
              <Field label="担当者" hint={d.perms.canAdmin ? undefined : "担当者の変更は管理者のみ"}>
                <select className={inputCls} disabled={!d.perms.canAdmin || busy} value={t.assignee_id ?? ""} onChange={(e) => patch({ action: "assign", assignee_id: e.target.value || null }, "担当者を変更しました。")}>
                  <option value="">未設定</option>
                  {opts?.users.filter((u) => u.role !== "viewer").map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </Field>
              <Field label="期限">
                <input type="date" className={inputCls} disabled={!d.perms.canEditDue || busy} value={t.due_date ?? ""} onChange={(e) => patch({ action: "assign", due_date: e.target.value || null })} />
              </Field>
              <p className="text-xs">区分: {t.requirement === "required" ? <Tag tone="teal">必須</Tag> : <Tag>任意(完了率の計算に含めない)</Tag>} {t.owner_mode === "enomoto" && <Tag tone="rose">榎本対応</Tag>}</p>
            </div>
          </Card>

          <Card title="前提となる作業">
            {d.prerequisites.length === 0 ? <p className="text-xs text-slate-500">なし(すぐに始められます)</p> : (
              <ul className="space-y-1 text-sm">
                {d.prerequisites.map((p) => <li key={p.id} className="flex items-center justify-between gap-2"><Link href={`/onboarding/tasks/${p.id}`} className="text-teal-700 hover:underline">{p.title}</Link><TaskBadge status={p.status} /></li>)}
              </ul>
            )}
          </Card>

          <Card title="使用するアカウント">
            <p className="whitespace-pre-line text-sm">{t.account_info || "—"}</p>
            {d.apple && <p className="mt-2 text-xs">この入職者のApple Account: <b>{d.apple.actual_email ?? `${d.apple.planned_email}(予約中・未作成)`}</b></p>}
            <dl className="mt-2 space-y-1 text-xs">
              <div>会社Googleアカウント: {d.companyGoogle ?? <Unset />}</div>
              <div>会社Wi-Fi: {d.wifiName ?? <Unset />}</div>
              <div>端末名の命名規則: {d.namingRule ?? <Unset />}</div>
              <div>認証情報の管理ツール: {d.credentialStore ?? <Unset />}</div>
            </dl>
          </Card>

          <Card title="手順書の版">
            <p className="text-xs text-slate-600">この作業の手順: 第{t.template_version}版{t.template_current_version ? `(最新 第${t.template_current_version}版)` : ""}</p>
            {t.template_updated_at && <p className="text-xs text-slate-500">標準手順の更新: {fmtDate(t.template_updated_at)} {t.template_updated_by_name ?? "初期登録"}</p>}
          </Card>

          <Card title="この作業の履歴">
            <ul className="max-h-72 space-y-1 overflow-y-auto text-xs">
              {d.history.length === 0 && <li className="text-slate-400">履歴はありません。</li>}
              {d.history.map((h, i) => <li key={i}><span className="text-slate-500">{fmtDate(h.at)}</span> <b>{h.user_name}</b> {h.action}{h.detail && <HistoryDetail detail={h.detail} />}</li>)}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
