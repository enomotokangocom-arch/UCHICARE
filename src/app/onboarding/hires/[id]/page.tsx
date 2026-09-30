"use client";

import Link from "next/link";
import { use, useState } from "react";
import { api, fmtDate, Options, useApi } from "@/onboarding/ui/client";
import { useMe } from "@/onboarding/ui/me";
import { Alert, Button, Card, HireBadge, PageTitle, Progress, Unset, useAction } from "@/onboarding/ui/kit";
import { HireForm, toForm } from "@/onboarding/ui/HireForm";
import { HireDetail } from "@/onboarding/ui/types";
import {
  ApplePanel, CredentialsPanel, DevicesPanel, HistoryPanel, OpenItemsPanel, RequestsPanel, ServicesPanel, StatusPanel, TaskList,
} from "@/onboarding/ui/HireSections";

export default function HirePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const me = useMe();
  const { data: d, error, reload } = useApi<HireDetail>(`/hires/${id}`);
  const { data: opts } = useApi<Options>(me.actor.role === "viewer" ? null : "/options");
  const [editing, setEditing] = useState(false);
  const { run, busy, msg } = useAction();

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!d) return <p className="text-sm text-slate-400">読み込み中...</p>;
  const h = d.hire;

  return (
    <div className="space-y-5">
      <PageTitle
        sub={`${h.name_romaji} / ${h.department_name} / ${h.office_name ?? "事業所未設定"} / 入社日 ${fmtDate(h.start_date)}`}
        actions={
          <>
            <Link href={`/onboarding/hires/${h.id}/print`} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">チェックリストを印刷</Link>
            {d.perms.canPrepare && !editing && <Button variant="secondary" onClick={() => setEditing(true)}>基本情報を編集</Button>}
          </>
        }
      >
        {h.name} <HireBadge status={h.status} />
      </PageTitle>

      <nav className="flex flex-wrap gap-2 text-xs print:hidden">
        {[["status", "状態"], ["tasks", "作業"], ["apple", "Apple"], ["devices", "端末"], ["services", "サービス"], ["requests", "発行依頼"], ["open", "未完了"], ["credentials", "参照先"], ["history", "履歴"]].map(([a, l]) => (
          <a key={a} href={`#${a}`} className="rounded-full bg-white px-3 py-1 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50">{l}</a>
        ))}
      </nav>

      <Card title="基本情報">
        {msg}
        {editing && opts ? (
          <HireForm
            initial={toForm(h as unknown as Record<string, unknown>)}
            opts={opts}
            canAssign={d.perms.canAdmin}
            isNew={false}
            busy={busy}
            onCancel={() => setEditing(false)}
            onSubmit={(v) => run(() => api(`/hires/${h.id}`, { method: "PATCH", body: v }).then(() => { setEditing(false); reload(); }), "保存しました。")}
          />
        ) : (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-4">
            <div><dt className="text-xs text-slate-500">氏名</dt><dd className="font-semibold">{h.name}</dd></div>
            <div><dt className="text-xs text-slate-500">氏名ローマ字</dt><dd>{h.name_romaji}</dd></div>
            <div><dt className="text-xs text-slate-500">職種</dt><dd>{h.job_type_name ?? <Unset />}</dd></div>
            <div><dt className="text-xs text-slate-500">部門・事業所</dt><dd>{h.department_name} / {h.office_name ?? <Unset />}</dd></div>
            <div><dt className="text-xs text-slate-500">入社日</dt><dd>{fmtDate(h.start_date)}</dd></div>
            <div><dt className="text-xs text-slate-500">準備期限</dt><dd>{fmtDate(h.prep_deadline)}</dd></div>
            <div><dt className="text-xs text-slate-500">準備担当者</dt><dd>{h.preparer_name ?? <Unset />}</dd></div>
            <div><dt className="text-xs text-slate-500">代行担当者</dt><dd>{h.deputy_name ?? <Unset />}</dd></div>
            <div><dt className="text-xs text-slate-500">確認管理者</dt><dd>{h.checker_name ?? <Unset />}</dd></div>
            <div><dt className="text-xs text-slate-500">Appleメール</dt><dd>{d.confirmedEmail ?? (d.activeApple ? `${d.activeApple.planned_email}(予約中)` : <Unset>未予約</Unset>)}</dd></div>
            <div><dt className="text-xs text-slate-500">必須作業の完了率</dt><dd><Progress value={d.progress.required_rate} /></dd></div>
            <div><dt className="text-xs text-slate-500">任意作業</dt><dd>{d.progress.optional_total ? `${d.progress.optional_done}/${d.progress.optional_total}` : "なし"}</dd></div>
          </dl>
        )}
      </Card>

      <StatusPanel d={d} reload={reload} />
      <TaskList d={d} />
      <div className="grid gap-5 lg:grid-cols-2">
        <ApplePanel d={d} reload={reload} />
        <OpenItemsPanel d={d} />
      </div>
      <DevicesPanel d={d} />
      <ServicesPanel d={d} reload={reload} />
      <RequestsPanel d={d} reload={reload} />
      <CredentialsPanel d={d} reload={reload} />
      <HistoryPanel d={d} />
    </div>
  );
}
