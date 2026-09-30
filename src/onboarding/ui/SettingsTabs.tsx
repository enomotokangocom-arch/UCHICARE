"use client";

import { useState } from "react";
import { api, fmtDate, Options, useApi } from "./client";
import { Alert, Button, Card, Check, Empty, Field, inputCls, Tag, Unset, useAction } from "./kit";
import { HistoryDetail } from "./HireSections";
import {
  ACCOUNT_TYPE_LABELS, OWNER_MODE_LABELS, PLACEMENT_LABELS, Placement, REQUIREMENT_LABELS, ROLE_LABELS, Role,
} from "../shared/labels";
import type { DiffLine } from "../shared/diff";

// ---------------------------------------------------------------------------

export function UnsetTab() {
  const { data } = useApi<{ unset: { area: string; item: string; where: string }[] }>("/admin/settings");
  if (!data) return null;
  return (
    <Card title={`初回に管理者が入力する未設定項目(${data.unset.length}件)`}>
      <p className="mb-3 text-xs text-slate-500">
        組織の判断が必要な情報は推測で登録していません。既存端末や社内の資料を確認して入力してください。入力すると一覧から消えます。
      </p>
      {data.unset.length === 0 ? <Empty>未設定の項目はありません。</Empty> : (
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs text-slate-500"><tr><th className="py-1.5">対象</th><th>未設定の項目</th><th>入力する場所</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {data.unset.map((u, i) => <tr key={i}><td className="py-1.5 font-semibold">{u.area}</td><td>{u.item}</td><td className="text-xs text-slate-500">{u.where}</td></tr>)}
          </tbody>
        </table>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------

export function BasicTab() {
  const { data, reload } = useApi<{ settings: { key: string; label: string; value: string | null }[] }>("/admin/settings");
  const [vals, setVals] = useState<Record<string, string>>({});
  const { run, busy, msg } = useAction();
  if (!data) return null;
  return (
    <Card title="基本設定">
      {msg}
      <div className="mt-2 grid gap-3 md:grid-cols-2">
        {data.settings.map((s) => (
          <Field key={s.key} label={s.label} hint={s.value === null ? <Unset /> : undefined}>
            <input className={inputCls} value={vals[s.key] ?? s.value ?? ""} onChange={(e) => setVals({ ...vals, [s.key]: e.target.value })} />
          </Field>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-slate-500">Wi-Fiのパスワード等の認証情報は入力しないでください(管理ツール名・保管庫名のみ)。</p>
      <Button className="mt-3" disabled={busy} onClick={() => run(() => api("/admin/settings", { method: "PATCH", body: vals }).then(() => { setVals({}); reload(); }), "保存しました。")}>保存</Button>
    </Card>
  );
}

// ---------------------------------------------------------------------------

type Service = Record<string, string | number | null> & { id: number; name: string };

const blankService = {
  name: "", placement: "unset", placement_confirmed: 0, url: "", app_store_url: "", account_type: "unset", account_note: "", needs_issuance: 0,
  requires_email: 0, issuer_label: "", issuer_user_id: "", deputy_user_id: "", owner_mode: "unset", procedure: "", completion_criteria: "",
  standard_days: "", credential_ref: "", sort: 999, active: 1,
};

export function ServicesTab() {
  const { data, reload } = useApi<{ services: Service[] }>("/admin/services");
  const { data: opts } = useApi<Options>("/options");
  const [edit, setEdit] = useState<{ id: number | null; v: Record<string, unknown> } | null>(null);
  const { run, busy, msg } = useAction();
  if (!data || !opts) return null;
  const v = edit?.v ?? {};
  const set = (k: string, val: unknown) => setEdit({ ...edit!, v: { ...v, [k]: val } });
  const txt = (k: string) => ({ className: inputCls, value: (v[k] ?? "") as string, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set(k, e.target.value) });

  return (
    <div className="space-y-4">
      {msg}
      {edit && (
        <Card title={edit.id ? `サービスを編集: ${String(v.name)}` : "サービスを追加"}>
          <Alert tone="info">URL・アプリは既存端末で実際に使っているものを確認してから入力してください。推測で登録しないでください。</Alert>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <Field label="サービス名" required><input {...txt("name")} /></Field>
            <Field label="配置方式">
              <select {...txt("placement")}>{Object.entries(PLACEMENT_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            </Field>
            <div className="flex items-end"><Check checked={!!v.placement_confirmed} onChange={(c) => set("placement_confirmed", c ? 1 : 0)} label="既存端末で確認し、配置方式を確定済み" /></div>
            <Field label="WebのURL"><input {...txt("url")} placeholder="https://" /></Field>
            <Field label="App StoreのURL"><input {...txt("app_store_url")} placeholder="https://apps.apple.com/..." /></Field>
            <Field label="並び順"><input {...txt("sort")} type="number" /></Field>
            <Field label="使用するアカウント">
              <select {...txt("account_type")}>{Object.entries(ACCOUNT_TYPE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            </Field>
            <div className="md:col-span-2"><Field label="アカウントの説明"><input {...txt("account_note")} /></Field></div>
            <div className="flex flex-col justify-end gap-1">
              <Check checked={!!v.needs_issuance} onChange={(c) => set("needs_issuance", c ? 1 : 0)} label="個別アカウントの発行(依頼)が必要" />
              <Check checked={!!v.requires_email} onChange={(c) => set("requires_email", c ? 1 : 0)} label="発行依頼に確定メールアドレスが必要" />
            </div>
            <Field label="発行担当(役割)" hint="例: 事務、責任者"><input {...txt("issuer_label")} /></Field>
            <Field label="発行担当者">
              <select {...txt("issuer_user_id")}><option value="">未設定</option>{opts.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
            </Field>
            <Field label="代行担当者">
              <select {...txt("deputy_user_id")}><option value="">未設定</option>{opts.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
            </Field>
            <Field label="担当区分" hint="管理権限を移管したら「移管済み」に変更">
              <select {...txt("owner_mode")}>{Object.entries(OWNER_MODE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            </Field>
            <Field label="標準の発行日数"><input {...txt("standard_days")} type="number" /></Field>
            <Field label="認証情報の参照先" hint="保管場所のみ。パスワードは入力しない"><input {...txt("credential_ref")} /></Field>
            <div className="md:col-span-3"><Field label="手順"><textarea {...txt("procedure")} rows={4} /></Field></div>
            <div className="md:col-span-3"><Field label="完了条件"><textarea {...txt("completion_criteria")} rows={2} /></Field></div>
            <Check checked={!!v.active} onChange={(c) => set("active", c ? 1 : 0)} label="有効(無効にすると新しい入職者に生成されない)" />
          </div>
          <div className="mt-3 flex gap-2">
            <Button disabled={busy} onClick={() => run(async () => {
              const body = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x === "" ? null : x]));
              if (edit.id) await api(`/admin/services/${edit.id}`, { method: "PATCH", body });
              else await api("/admin/services", { method: "POST", body });
              setEdit(null); reload();
            }, edit.id ? "保存しました。" : "追加しました。部門別サービスで必須・任意を設定してください。")}>保存</Button>
            <Button variant="secondary" onClick={() => setEdit(null)}>キャンセル</Button>
          </div>
        </Card>
      )}
      <Card title="サービス一覧" actions={<Button size="sm" onClick={() => setEdit({ id: null, v: { ...blankService } })}>+ サービスを追加</Button>}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-sm">
            <thead className="border-b text-left text-xs text-slate-500"><tr><th className="py-2">サービス</th><th>配置方式</th><th>URL</th><th>アカウント</th><th>発行担当</th><th>担当区分</th><th>参照先</th><th>更新</th><th></th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {data.services.map((s) => (
                <tr key={s.id} className={s.active ? "" : "text-slate-400"}>
                  <td className="py-2 font-semibold">{s.name}{!s.active && <Tag>無効</Tag>}</td>
                  <td className="text-xs">{s.placement_confirmed ? PLACEMENT_LABELS[s.placement as Placement] : <Unset>未確定</Unset>}</td>
                  <td className="max-w-48 truncate text-xs">{s.url ?? s.app_store_url ?? <Unset />}</td>
                  <td className="text-xs">{s.account_type === "unset" ? <Unset /> : ACCOUNT_TYPE_LABELS[s.account_type as keyof typeof ACCOUNT_TYPE_LABELS]}</td>
                  <td className="text-xs">{s.needs_issuance ? <>{s.issuer_label ?? <Unset />} / {s.issuer_name ?? <Unset>担当者未設定</Unset>}{s.deputy_name && <div>代行: {s.deputy_name}</div>}</> : "—"}</td>
                  <td className="text-xs">{s.needs_issuance ? (s.owner_mode === "enomoto" ? <Tag tone="rose">榎本対応</Tag> : s.owner_mode === "transferred" ? <Tag tone="teal">移管済み</Tag> : <Unset />) : "—"}</td>
                  <td className="text-xs">{s.credential_ref ? "登録あり" : s.account_type === "none" ? "—" : <Unset />}</td>
                  <td className="text-[11px] text-slate-500">{fmtDate(s.updated_at)}<div>{s.updated_by_name ?? "初期登録"}</div></td>
                  <td><Button size="sm" variant="secondary" onClick={() => setEdit({ id: s.id, v: Object.fromEntries(Object.keys(blankService).map((k) => [k, s[k] ?? ""])) })}>編集</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function DeptTab() {
  const { data, reload } = useApi<{ services: Service[]; deptReq: { department_id: number; service_id: number; requirement: string }[]; departments: { id: number; name: string }[] }>("/admin/services");
  const { run, busy, msg } = useAction();
  if (!data) return null;
  const req = (d: number, s: number) => data.deptReq.find((x) => x.department_id === d && x.service_id === s)?.requirement ?? "excluded";
  return (
    <Card title="部門別の必須・任意・対象外">
      <p className="mb-2 text-xs text-slate-500">変更は、これから登録する入職者に反映されます。進行中の入職者には、入職者詳細の「サービス」欄からサービスを追加できます(管理者)。居宅独自の記録・請求システムは「サービス一覧」で追加してから、ここで居宅介護支援を「必須」にしてください。</p>
      {msg}
      <table className="w-full text-sm">
        <thead className="border-b text-left text-xs text-slate-500"><tr><th className="py-2">サービス</th>{data.departments.map((d) => <th key={d.id}>{d.name}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">
          {data.services.filter((s) => s.active).map((s) => (
            <tr key={s.id}>
              <td className="py-1.5 font-semibold">{s.name}</td>
              {data.departments.map((d) => (
                <td key={d.id}>
                  <select className="rounded border border-slate-300 px-2 py-1 text-sm" disabled={busy} value={req(d.id, s.id)}
                    onChange={(e) => run(() => api("/admin/department-services", { method: "PUT", body: { department_id: d.id, service_id: s.id, requirement: e.target.value } }).then(reload))}>
                    {Object.entries(REQUIREMENT_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

// ---------------------------------------------------------------------------

type Template = {
  id: number; code: string; sort_no: number; title: string; assignee_type: string; fixed_user_id: number | null; requirement: string; prerequisites: string;
  procedure: string; completion_criteria: string; related_urls: string; account_info: string; device_check: string; due_offset_days: number;
  completion_mode: string; owner_mode: string; condition: string | null; version: number; active: number; updated_at: string | null; updated_by_name: string | null; outdated_open: number;
};
type Preview = {
  template: Template;
  outdated: { task_id: number; hire_id: number; hire_name: string; start_date: string; from_version: number; status: string; diffs: { field: string; lines: DiffLine[] }[] }[];
  missing: { hire_id: number; hire_name: string; start_date: string }[];
  keptCompleted: number;
  revisions: { version: number; summary: string | null; changed_at: string; changed_by_name: string | null }[];
};
const FIELD_LABELS: Record<string, string> = { title: "作業名", requirement: "必須・任意", prerequisites: "前提作業", procedure: "操作手順", completion_criteria: "完了条件", related_urls: "関連URL", account_info: "使用するアカウント", device_check: "端末ごとの確認", owner_mode: "担当区分" };

export function TemplatesTab() {
  const { data, reload } = useApi<Template[]>("/admin/templates");
  const { data: opts } = useApi<Options>("/options");
  const [edit, setEdit] = useState<{ id: number | null; v: Record<string, unknown>; summary: string } | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [selTasks, setSelTasks] = useState<number[]>([]);
  const [selHires, setSelHires] = useState<number[]>([]);
  const { run, busy, msg } = useAction();
  if (!data) return null;
  const v = edit?.v ?? {};
  const set = (k: string, val: unknown) => setEdit({ ...edit!, v: { ...v, [k]: val } });
  const txt = (k: string) => ({ className: inputCls, value: (v[k] ?? "") as string, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set(k, e.target.value) });
  const openPreview = (id: number) => run(async () => {
    const p = await api<Preview>(`/admin/templates/${id}/preview`);
    setPreview(p); setSelTasks(p.outdated.map((o) => o.task_id)); setSelHires([]);
  });

  return (
    <div className="space-y-4">
      {msg}
      <Alert tone="info">
        標準手順を変更しても、入職者ごとの作業(過去の完了記録を含む)は自動では書き換わりません。進行中の入職者に反映する場合は「差分を確認して適用」から、変更内容を確認して選んだ作業にだけ適用します。
      </Alert>
      {edit && (
        <Card title={edit.id ? `標準手順を編集: ${String(v.title)}` : "標準手順を追加"}>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="md:col-span-2"><Field label="作業名" required><input {...txt("title")} /></Field></div>
            <Field label="並び順"><input {...txt("sort_no")} type="number" /></Field>
            <Field label="標準期限(入社日からの日数)" hint="-7 = 入社日の7日前"><input {...txt("due_offset_days")} type="number" /></Field>
            <Field label="必須・任意"><select {...txt("requirement")}><option value="required">必須</option><option value="optional">任意</option></select></Field>
            <Field label="担当">
              <select {...txt("assignee_type")}><option value="preparer">準備担当者</option><option value="checker">確認管理者</option><option value="fixed_user">特定のユーザー</option></select>
            </Field>
            {v.assignee_type === "fixed_user" && (
              <Field label="担当ユーザー"><select {...txt("fixed_user_id")}><option value="">選択</option>{opts?.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
            )}
            <Field label="端末ごとの確認"><select {...txt("device_check")}><option value="none">なし</option><option value="both">iPhone・iPadそれぞれ確認</option></select></Field>
            <Field label="担当区分"><select {...txt("owner_mode")}><option value="transferred">移管済み</option><option value="enomoto">榎本への依頼が必要</option><option value="unset">未設定</option></select></Field>
            <div className="md:col-span-4"><Field label="前提となる作業" hint={`作業コードをカンマ区切り(${data.map((t) => `${t.code}=${t.title.slice(0, 8)}`).slice(0, 6).join("、")}…)`}><input {...txt("prerequisites")} /></Field></div>
            <div className="md:col-span-4"><Field label="操作手順" hint="1行に1手順。「1.」から始まる行は作業画面でチェックできます"><textarea {...txt("procedure")} rows={10} /></Field></div>
            <div className="md:col-span-4"><Field label="完了条件" required><textarea {...txt("completion_criteria")} rows={2} /></Field></div>
            <div className="md:col-span-2"><Field label="関連サービスのURL(任意)"><textarea {...txt("related_urls")} rows={2} /></Field></div>
            <div className="md:col-span-2"><Field label="使用するアカウント"><textarea {...txt("account_info")} rows={2} /></Field></div>
            <div className="md:col-span-4"><Field label="変更内容の説明(履歴に残ります)"><input className={inputCls} value={edit.summary} onChange={(e) => setEdit({ ...edit, summary: e.target.value })} /></Field></div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button disabled={busy} onClick={() => run(async () => {
              const body = { ...Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x === "" ? null : x])), summary: edit.summary };
              if (edit.id) await api(`/admin/templates/${edit.id}`, { method: "PATCH", body });
              else await api("/admin/templates", { method: "POST", body });
              setEdit(null); reload();
            }, "保存しました。進行中の入職者へ反映する場合は「差分を確認して適用」を押してください。")}>保存</Button>
            <Button variant="secondary" onClick={() => setEdit(null)}>キャンセル</Button>
          </div>
        </Card>
      )}

      {preview && (
        <Card title={`差分の確認: ${preview.template.title}(最新 第${preview.template.version}版)`} actions={<Button size="sm" variant="secondary" onClick={() => setPreview(null)}>閉じる</Button>}>
          <p className="text-xs text-slate-500">完了・対象外の作業 {preview.keptCompleted}件 は過去の記録として保持し、変更しません。</p>
          {preview.outdated.length === 0 && preview.missing.length === 0 && <Empty>適用が必要な進行中の作業はありません。</Empty>}
          <div className="mt-2 space-y-3">
            {preview.outdated.map((o) => (
              <div key={o.task_id} className="rounded-lg border border-slate-200 p-3">
                <Check checked={selTasks.includes(o.task_id)} onChange={(c) => setSelTasks(c ? [...selTasks, o.task_id] : selTasks.filter((x) => x !== o.task_id))} label={`${o.hire_name}(入社 ${fmtDate(o.start_date)})第${o.from_version}版 → 第${preview.template.version}版`} />
                {o.diffs.map((df) => (
                  <div key={df.field} className="mt-2">
                    <p className="text-xs font-semibold text-slate-600">{FIELD_LABELS[df.field] ?? df.field}</p>
                    <pre className="mt-1 overflow-x-auto rounded bg-slate-50 p-2 text-xs leading-relaxed">
                      {df.lines.map((l, i) => (
                        <div key={i} className={l.type === "add" ? "bg-emerald-100 text-emerald-900" : l.type === "del" ? "bg-rose-100 text-rose-900 line-through" : "text-slate-500"}>
                          {l.type === "add" ? "+ " : l.type === "del" ? "- " : "  "}{l.text}
                        </div>
                      ))}
                    </pre>
                  </div>
                ))}
              </div>
            ))}
            {preview.missing.length > 0 && (
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs font-semibold">この作業がない準備中の入職者(追加できます)</p>
                {preview.missing.map((m) => <div key={m.hire_id}><Check checked={selHires.includes(m.hire_id)} onChange={(c) => setSelHires(c ? [...selHires, m.hire_id] : selHires.filter((x) => x !== m.hire_id))} label={`${m.hire_name}(入社 ${fmtDate(m.start_date)})`} /></div>)}
              </div>
            )}
          </div>
          {(preview.outdated.length > 0 || preview.missing.length > 0) && (
            <Button className="mt-3" disabled={busy || (selTasks.length === 0 && selHires.length === 0)} onClick={() => run(async () => {
              await api(`/admin/templates/${preview.template.id}/apply`, { method: "POST", body: { task_ids: selTasks, add_hire_ids: selHires } });
              setPreview(null); reload();
            }, "選択した作業に適用しました。")}>選択した作業に適用</Button>
          )}
          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-600">改訂履歴</p>
            <ul className="text-xs text-slate-600">{preview.revisions.map((r) => <li key={r.version}>第{r.version}版 {fmtDate(r.changed_at)} {r.changed_by_name ?? "初期登録"} {r.summary ?? ""}</li>)}</ul>
          </div>
        </Card>
      )}

      <Card title="標準手順(チェックリスト)" actions={<Button size="sm" onClick={() => setEdit({ id: null, v: { title: "", sort_no: 125, assignee_type: "preparer", requirement: "optional", prerequisites: "", procedure: "", completion_criteria: "", related_urls: "", account_info: "", device_check: "none", due_offset_days: -5, owner_mode: "transferred" }, summary: "" })}>+ 作業を追加</Button>}>
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs text-slate-500"><tr><th className="py-2">No</th><th>作業名</th><th>区分</th><th>担当</th><th>標準期限</th><th>版・更新</th><th></th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((t, i) => (
              <tr key={t.id} className={t.active ? "" : "text-slate-400"}>
                <td className="py-2 text-xs">{i + 1}</td>
                <td className="font-semibold">{t.title}{t.condition && <div className="text-[11px] font-normal text-slate-500">配置方式が未確定のサービスがある場合のみ生成</div>}{t.completion_mode === "system" && <div className="text-[11px] font-normal text-slate-500">入職者詳細の操作で自動完了</div>}</td>
                <td>{t.requirement === "required" ? <Tag tone="teal">必須</Tag> : <Tag>任意</Tag>}</td>
                <td className="text-xs">{t.assignee_type === "checker" ? "確認管理者" : t.assignee_type === "fixed_user" ? "特定ユーザー" : "準備担当者"}{t.owner_mode === "enomoto" && <div><Tag tone="rose">榎本対応</Tag></div>}</td>
                <td className="text-xs">入社日{t.due_offset_days <= 0 ? `の${-t.due_offset_days}日前` : `の${t.due_offset_days}日後`}</td>
                <td className="text-[11px] text-slate-500">第{t.version}版<div>{fmtDate(t.updated_at)} {t.updated_by_name ?? "初期登録"}</div></td>
                <td className="space-x-1 whitespace-nowrap">
                  <Button size="sm" variant="secondary" onClick={() => setEdit({ id: t.id, v: { ...t, prerequisites: JSON.parse(t.prerequisites).join(","), fixed_user_id: t.fixed_user_id ?? "" }, summary: "" })}>編集</Button>
                  <Button size="sm" variant={t.outdated_open ? "primary" : "ghost"} onClick={() => openPreview(t.id)}>差分を確認して適用{t.outdated_open ? `(${t.outdated_open})` : ""}</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function OfficesTab() {
  const { data: opts, reload } = useApi<Options>("/options");
  const { run, busy, msg } = useAction();
  const [office, setOffice] = useState({ name: "", department_id: "" });
  const [job, setJob] = useState("");
  if (!opts) return null;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="事業所">
        {msg}
        <ul className="divide-y divide-slate-100 text-sm">
          {opts.offices.map((o) => (
            <li key={o.id} className="flex items-center justify-between py-1.5">
              <span className={o.active ? "" : "text-slate-400 line-through"}>{o.name} <span className="text-xs text-slate-500">{opts.departments.find((d) => d.id === o.department_id)?.name ?? "全部門"}</span></span>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => api(`/admin/offices/${o.id}`, { method: "PATCH", body: { name: o.name, department_id: o.department_id, active: !o.active } }).then(reload))}>{o.active ? "無効にする" : "有効にする"}</Button>
            </li>
          ))}
          {opts.offices.length === 0 && <li className="py-2 text-xs text-slate-500">未登録です。</li>}
        </ul>
        <div className="mt-3 grid gap-2 md:grid-cols-[2fr_1fr_auto]">
          <input className={inputCls} placeholder="事業所名" value={office.name} onChange={(e) => setOffice({ ...office, name: e.target.value })} />
          <select className={inputCls} value={office.department_id} onChange={(e) => setOffice({ ...office, department_id: e.target.value })}>
            <option value="">全部門</option>{opts.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <Button disabled={busy} onClick={() => run(() => api("/admin/offices", { method: "POST", body: office }).then(() => { setOffice({ name: "", department_id: "" }); reload(); }))}>追加</Button>
        </div>
      </Card>
      <Card title="職種">
        <ul className="divide-y divide-slate-100 text-sm">
          {opts.jobTypes.map((j) => (
            <li key={j.id} className="flex items-center justify-between py-1.5">
              <span className={j.active ? "" : "text-slate-400 line-through"}>{j.name}</span>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => api(`/admin/job-types/${j.id}`, { method: "PATCH", body: { name: j.name, active: !j.active } }).then(reload))}>{j.active ? "無効にする" : "有効にする"}</Button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex gap-2">
          <input className={inputCls} placeholder="職種名" value={job} onChange={(e) => setJob(e.target.value)} />
          <Button disabled={busy} onClick={() => run(() => api("/admin/job-types", { method: "POST", body: { name: job } }).then(() => { setJob(""); reload(); }))}>追加</Button>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------

type User = { id: number; login_id: string; name: string; role: Role; is_representative: number; scope_office_ids: number[]; active: number };
const blankUser = { login_id: "", name: "", role: "preparer" as Role, is_representative: 0, scope_office_ids: [] as number[], active: 1, password: "" };

export function UsersTab() {
  const { data, reload } = useApi<User[]>("/admin/users");
  const { data: opts } = useApi<Options>("/options");
  const [edit, setEdit] = useState<{ id: number | null; v: typeof blankUser } | null>(null);
  const { run, busy, msg } = useAction();
  if (!data || !opts) return null;
  const v = edit?.v ?? blankUser;
  const set = (patch: Partial<typeof blankUser>) => setEdit({ ...edit!, v: { ...v, ...patch } });
  return (
    <div className="space-y-4">
      {msg}
      <Card title="役割と権限">
        <ul className="grid gap-1 text-xs text-slate-600 md:grid-cols-2">
          <li><b>管理者</b>: 全体設定、担当変更、完了確認、すべての入職者</li>
          <li><b>準備担当者</b>: 割り当てられた入職者の準備(端末・番号予約・依頼記録など)</li>
          <li><b>事務・発行責任者</b>: 担当サービスの発行状況の更新(サービス一覧で発行担当者に設定)</li>
          <li><b>閲覧者</b>: 許可された事業所の進捗確認のみ</li>
        </ul>
      </Card>
      {edit && (
        <Card title={edit.id ? "ユーザーを編集" : "ユーザーを追加"}>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="氏名" required><input className={inputCls} value={v.name} onChange={(e) => set({ name: e.target.value })} /></Field>
            <Field label="ログインID" required><input className={inputCls} value={v.login_id} onChange={(e) => set({ login_id: e.target.value })} /></Field>
            <Field label="役割" required>
              <select className={inputCls} value={v.role} onChange={(e) => set({ role: e.target.value as Role })}>{Object.entries(ROLE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            </Field>
            <Field label={edit.id ? "新しいパスワード(変更時のみ)" : "初期パスワード"} required={!edit.id} hint="8文字以上。本人に口頭等で伝え、このツール以外に記録しないでください">
              <input type="password" className={inputCls} value={v.password} onChange={(e) => set({ password: e.target.value })} autoComplete="new-password" />
            </Field>
            <div className="flex flex-col justify-end gap-1">
              <Check checked={!!v.is_representative} onChange={(c) => set({ is_representative: c ? 1 : 0 })} label="代表(榎本)として扱う" />
              <Check checked={!!v.active} onChange={(c) => set({ active: c ? 1 : 0 })} label="有効" />
            </div>
            {v.role === "viewer" && (
              <Field label="閲覧を許可する事業所">
                <div className="space-y-1 rounded-lg border border-slate-200 p-2">
                  {opts.offices.map((o) => <div key={o.id}><Check checked={v.scope_office_ids.includes(o.id)} onChange={(c) => set({ scope_office_ids: c ? [...v.scope_office_ids, o.id] : v.scope_office_ids.filter((x) => x !== o.id) })} label={o.name} /></div>)}
                </div>
              </Field>
            )}
          </div>
          <div className="mt-3 flex gap-2">
            <Button disabled={busy} onClick={() => run(async () => {
              if (edit.id) await api(`/admin/users/${edit.id}`, { method: "PATCH", body: v });
              else await api("/admin/users", { method: "POST", body: v });
              setEdit(null); reload();
            }, "保存しました。")}>保存</Button>
            <Button variant="secondary" onClick={() => setEdit(null)}>キャンセル</Button>
          </div>
        </Card>
      )}
      <Card title="ユーザー" actions={<Button size="sm" onClick={() => setEdit({ id: null, v: { ...blankUser } })}>+ ユーザーを追加</Button>}>
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs text-slate-500"><tr><th className="py-2">氏名</th><th>ログインID</th><th>役割</th><th>閲覧範囲</th><th>状態</th><th></th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((u) => (
              <tr key={u.id} className={u.active ? "" : "text-slate-400"}>
                <td className="py-2 font-semibold">{u.name}{u.is_representative ? <Tag tone="rose">代表</Tag> : null}</td>
                <td className="text-xs">{u.login_id}</td>
                <td className="text-xs">{ROLE_LABELS[u.role]}</td>
                <td className="text-xs">{u.role === "viewer" ? (u.scope_office_ids.map((id) => opts.offices.find((o) => o.id === id)?.name).filter(Boolean).join("、") || <Unset>なし</Unset>) : "—"}</td>
                <td className="text-xs">{u.active ? "有効" : "無効"}</td>
                <td><Button size="sm" variant="secondary" onClick={() => setEdit({ id: u.id, v: { ...u, password: "" } })}>編集</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function AuditTab() {
  const [entity, setEntity] = useState("");
  const { data } = useApi<{ id: number; at: string; user_name: string; action: string; entity: string; hire_name: string | null; detail: string | null }[]>(`/admin/audit${entity ? `?entity=${entity}` : ""}`);
  return (
    <Card title="変更履歴(直近300件)" actions={
      <select className="rounded border border-slate-300 px-2 py-1 text-sm" value={entity} onChange={(e) => setEntity(e.target.value)}>
        <option value="">すべて</option><option value="hire">入職者</option><option value="task">作業</option><option value="template">標準手順</option><option value="service">サービス</option>
        <option value="apple">Apple番号</option><option value="account_request">発行依頼</option><option value="device">端末</option><option value="user">ユーザー</option><option value="settings">設定</option>
      </select>
    }>
      {!data ? null : data.length === 0 ? <Empty>履歴はありません。</Empty> : (
        <ul className="divide-y divide-slate-100 text-xs">
          {data.map((a) => (
            <li key={a.id} className="py-1.5">
              <span className="text-slate-500">{fmtDate(a.at)}</span> <b>{a.user_name}</b> {a.action}
              {a.hire_name && <span className="ml-1 text-teal-700">[{a.hire_name}]</span>}
              {a.detail && <HistoryDetail detail={a.detail} />}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------

export function DataTab() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="バックアップと復元">
        <div className="space-y-2 text-sm">
          <p>データはサーバーの <code className="rounded bg-slate-100 px-1">data/onboarding.db</code>(SQLite)に保存されています。</p>
          <p className="font-semibold">バックアップ(稼働中でも実行できます)</p>
          <pre className="rounded bg-slate-900 p-2 text-xs text-slate-100">npm run onboarding:backup</pre>
          <p className="text-xs text-slate-600"><code>backups/onboarding-日時.db</code> が作成されます。週1回以上、社内の安全な保管場所にコピーしてください。</p>
          <p className="font-semibold">復元(サーバーを停止してから)</p>
          <pre className="rounded bg-slate-900 p-2 text-xs text-slate-100">npm run onboarding:restore -- backups/onboarding-日時.db</pre>
          <p className="text-xs text-slate-600">復元前のデータは自動で退避されます。</p>
        </div>
      </Card>
      <Card title="認証情報の扱い">
        <div className="space-y-2 text-sm">
          <Alert tone="warn">このツールには実際のパスワード・端末パスコードを保存しません。会社が管理する認証情報管理ツール(パスワード管理ツール等)の「どこに保管したか」だけを登録します。</Alert>
          <ul className="list-disc space-y-1 pl-5 text-xs text-slate-700">
            <li>参照先を閲覧できるのは、管理者とその入職者の準備担当者(代行含む)だけです。</li>
            <li>印刷・CSV・依頼文・変更履歴には参照先を含めません。</li>
            <li>コメントや備考に「PW: ○○」のような記述があると保存を拒否します。</li>
            <li>Appleのパスワードを他サービスに流用しないでください。各サービスのパスワードは別途管理者が設定します。</li>
          </ul>
          <p className="font-semibold">既存の管理者用認証情報資料を移す場合</p>
          <ol className="list-decimal space-y-1 pl-5 text-xs text-slate-700">
            <li>資料をこのツールに読み込むことはできません(自動取り込みは行いません)。</li>
            <li>資料の内容は、会社の認証情報管理ツールへ管理者が登録します。</li>
            <li>このツールには、サービスごとの「認証情報の参照先」(サービス一覧)と、入職者ごとの参照先(入職者詳細)だけを登録します。</li>
            <li>移行後、元の資料の保管・廃棄方法を管理者が決めてください。</li>
          </ol>
        </div>
      </Card>
    </div>
  );
}
