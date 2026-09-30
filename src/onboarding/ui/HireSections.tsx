"use client";

import Link from "next/link";
import { useState } from "react";
import { api, fmtDate, todayLocal } from "./client";
import { useMe } from "./me";
import { Alert, Button, Card, Check, Empty, Field, inputCls, TaskBadge, Tag, Unset, useAction } from "./kit";
import { HireDetail } from "./types";
import {
  ACCOUNT_TYPE_LABELS, AccountType, APPLE_STATUS_LABELS, AppleStatus, LEND_STATUS_LABELS, LendStatus, PLACEMENT_LABELS, Placement,
  REQUEST_STATUS_LABELS, RequestStatus, REQUIREMENT_LABELS, Requirement, pad3,
} from "../shared/labels";

type P = { d: HireDetail; reload: () => void };

// ---------------------------------------------------------------------------
// 状態と操作(準備完了 → 管理者確認 → 貸与)
// ---------------------------------------------------------------------------

export function StatusPanel({ d, reload }: P) {
  const { run, busy, msg } = useAction();
  const [note, setNote] = useState("");
  const [lend, setLend] = useState({ lent_date: todayLocal(), explanation_note: "" });
  const [reason, setReason] = useState("");
  const h = d.hire;
  return (
    <Card title="準備の状態" id="status">
      <div className="space-y-3">
        {msg}
        <ol className="grid grid-cols-1 gap-2 text-sm md:grid-cols-4">
          {[
            { k: "preparing", label: "1. 準備中", sub: `必須作業 ${d.progress.required_done}/${d.progress.required_total}` },
            { k: "ready", label: "2. 準備完了(確認待ち)", sub: h.ready_at ? fmtDate(h.ready_at) : "準備担当者が操作" },
            { k: "confirmed", label: "3. 管理者確認済み", sub: h.confirmed_at ? `${fmtDate(h.confirmed_at)} ${h.confirmed_by_name ?? ""}` : "管理者が操作" },
            { k: "lent", label: "4. 貸与済み", sub: h.lent_date ? `${fmtDate(h.lent_date)} ${h.lent_by_name ?? ""}` : "貸与後に記録" },
          ].map((s, i) => {
            const order = ["preparing", "ready", "confirmed", "lent"];
            const reached = order.indexOf(h.status) >= i;
            return (
              <li key={s.k} className={`rounded-lg border px-3 py-2 ${h.status === s.k ? "border-teal-500 bg-teal-50" : reached ? "border-emerald-200 bg-emerald-50" : "border-slate-200"}`}>
                <p className="font-semibold">{s.label}</p>
                <p className="text-[11px] text-slate-500">{s.sub}</p>
              </li>
            );
          })}
        </ol>

        {h.status === "preparing" && (
          <div className="space-y-2">
            {d.blockers.length > 0 ? (
              <Alert tone="warn">
                <p className="font-semibold">準備完了にするには、次の項目を完了してください({d.blockers.length}件)</p>
                <ul className="mt-1 list-disc pl-5 text-xs">{d.blockers.map((b) => <li key={b}>{b}</li>)}</ul>
              </Alert>
            ) : (
              <Alert tone="success">必須作業はすべて完了しています。「準備完了にする」を押して管理者に確認を依頼してください。</Alert>
            )}
            {d.perms.canPrepare && (
              <Button disabled={busy || d.blockers.length > 0} onClick={() => run(() => api(`/hires/${h.id}/ready`, { method: "POST", body: {} }).then(reload))}>
                準備完了にする
              </Button>
            )}
          </div>
        )}

        {h.status === "ready" && d.perms.canAdmin && (
          <div className="space-y-2 rounded-lg bg-violet-50 p-3">
            <p className="text-sm font-semibold text-violet-900">管理者の確認</p>
            <p className="text-xs text-violet-800">iPhone・iPadを実際に操作し、主要サービスの起動とログインを確認してから記録してください。</p>
            <Field label="確認した内容" required>
              <textarea className={inputCls} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="例: iPhone・iPadでLINE WORKS・ZEST・iBOWの起動とログイン、通知を確認" />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy} onClick={() => run(() => api(`/hires/${h.id}/confirm`, { method: "POST", body: { note } }).then(reload))}>管理者確認を記録</Button>
            </div>
          </div>
        )}
        {h.status === "ready" && !d.perms.canAdmin && <Alert tone="info">管理者の確認待ちです。</Alert>}

        {h.confirm_note && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
            <p className="font-semibold text-emerald-900">管理者の確認記録({fmtDate(h.confirmed_at)} {h.confirmed_by_name})</p>
            <p className="mt-1 whitespace-pre-line text-emerald-900">{h.confirm_note}</p>
          </div>
        )}

        {h.status === "confirmed" && d.perms.canPrepare && (
          <div className="space-y-2 rounded-lg bg-teal-50 p-3">
            <p className="text-sm font-semibold text-teal-900">貸与と操作説明の記録</p>
            <div className="grid gap-2 md:grid-cols-4">
              <Field label="貸与日" required><input type="date" className={inputCls} value={lend.lent_date} onChange={(e) => setLend({ ...lend, lent_date: e.target.value })} /></Field>
              <div className="md:col-span-3">
                <Field label="操作説明の内容" required>
                  <textarea className={inputCls} rows={2} value={lend.explanation_note} onChange={(e) => setLend({ ...lend, explanation_note: e.target.value })} placeholder="例: 画面ロックの解除、主要アプリの場所、困ったときの連絡先を説明" />
                </Field>
              </div>
            </div>
            <Button disabled={busy} onClick={() => run(() => api(`/hires/${h.id}/lend`, { method: "POST", body: lend }).then(reload))}>貸与を記録</Button>
          </div>
        )}

        {h.explanation_note && (
          <div className="rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm">
            <p className="font-semibold text-teal-900">貸与・操作説明の記録({fmtDate(h.lent_date)} {h.lent_by_name})</p>
            <p className="mt-1 whitespace-pre-line">{h.explanation_note}</p>
          </div>
        )}

        {d.perms.canAdmin && (h.status === "ready" || h.status === "confirmed") && (
          <details className="text-sm">
            <summary className="cursor-pointer text-xs text-slate-500">準備中に差し戻す</summary>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <input className={`${inputCls} max-w-md`} placeholder="差し戻しの理由" value={reason} onChange={(e) => setReason(e.target.value)} />
              <Button variant="danger" size="sm" disabled={busy} onClick={() => run(() => api(`/hires/${h.id}/send-back`, { method: "POST", body: { reason } }).then(reload))}>差し戻す</Button>
            </div>
          </details>
        )}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// 作業チェックリスト
// ---------------------------------------------------------------------------

export function TaskList({ d }: { d: HireDetail }) {
  const today = todayLocal();
  return (
    <Card title="作業チェックリスト" id="tasks" actions={<span className="text-xs text-slate-500">作業名を押すと手順と完了条件が開きます</span>}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-slate-200 text-left text-xs text-slate-500">
            <tr><th className="py-2 pr-2">No.</th><th className="pr-2">作業</th><th className="pr-2">区分</th><th className="pr-2">担当者</th><th className="pr-2">期限</th><th className="pr-2">iPhone / iPad</th><th>状態</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {d.tasks.map((t, i) => {
              const overdue = t.due_date && t.due_date < today && !["done", "na"].includes(t.status);
              return (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="py-2 pr-2 text-xs text-slate-400">{i + 1}</td>
                  <td className="pr-2">
                    <Link href={`/onboarding/tasks/${t.id}`} className="font-semibold text-teal-700 hover:underline">{t.title}</Link>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {t.owner_mode === "enomoto" && <Tag tone="rose">榎本対応</Tag>}
                      {t.template_current_version && t.template_version < t.template_current_version && !["done", "na"].includes(t.status) && <Tag tone="amber">手順が更新されています</Tag>}
                      {t.status === "na" && t.na_reason && <span className="text-[11px] text-slate-500">対象外の理由: {t.na_reason}</span>}
                    </div>
                  </td>
                  <td className="pr-2">{t.requirement === "required" ? <Tag tone="teal">必須</Tag> : <Tag>任意</Tag>}</td>
                  <td className="pr-2 text-xs">{t.assignee_name ?? <Unset />}</td>
                  <td className={`pr-2 text-xs ${overdue ? "font-semibold text-rose-700" : ""}`}>{fmtDate(t.due_date)}{overdue && " 超過"}</td>
                  <td className="pr-2 text-xs">
                    {t.device_check === "both" ? (
                      <span>{t.iphone_checked_at ? "✅" : "⬜"} iPhone ・ {t.ipad_checked_at ? "✅" : "⬜"} iPad</span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td><TaskBadge status={t.status} />{t.completed_at && <div className="text-[10px] text-slate-500">{fmtDate(t.completed_at)} {t.completed_by_name}</div>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Appleアカウント
// ---------------------------------------------------------------------------

export function ApplePanel({ d, reload }: P) {
  const { run, busy, msg } = useAction();
  const a = d.activeApple;
  const [email, setEmail] = useState("");
  const [memo, setMemo] = useState("");
  const [fail, setFail] = useState({ open: false, reason: "", mark: "unusable" });
  const [cancelReason, setCancelReason] = useState("");
  const post = (id: number, body: Record<string, unknown>) => api(`/apple/${id}`, { method: "POST", body }).then(reload);
  return (
    <Card title="Appleアカウント" id="apple">
      <div className="space-y-3 text-sm">
        {msg}
        <p className="text-xs text-slate-500">
          「番号予約」はこのツール上で番号とメールアドレスを確保する操作です。Apple側のアカウント作成は人が行い、終わったら「作成済みとして記録」します。
        </p>
        {!a && (
          <div className="flex flex-wrap items-center gap-3">
            <Tag tone="amber">未予約</Tag>
            {d.perms.canPrepare && (
              <Button disabled={busy} onClick={() => run(() => api(`/hires/${d.hire.id}/apple`, { method: "POST", body: {} }).then(reload), "番号を予約しました。")}>
                次の番号を予約する
              </Button>
            )}
          </div>
        )}
        {a && (
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-2xl font-bold tabular-nums">{pad3(a.number)}</span>
              <Tag tone={a.status === "created" ? "teal" : "amber"}>{APPLE_STATUS_LABELS[a.status as AppleStatus]}</Tag>
              <span className="text-xs text-slate-500">予約: {fmtDate(a.reserved_at)} {a.reserved_by_name}</span>
            </div>
            <p className="mt-2">予定メール: <b>{a.planned_email}</b></p>
            <p>実際に作成したメール: {a.actual_email ? <b>{a.actual_email}</b> : <span className="text-slate-400">未作成</span>}</p>
            {a.status === "reserved" && d.perms.canPrepare && (
              <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-700">Apple側でアカウントを作成したら記録してください</p>
                <div className="grid gap-2 md:grid-cols-2">
                  <input className={inputCls} placeholder={a.planned_email} value={email} onChange={(e) => setEmail(e.target.value)} />
                  <input className={inputCls} placeholder="メモ(予定と異なるアドレスの場合は理由)" value={memo} onChange={(e) => setMemo(e.target.value)} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" disabled={busy} onClick={() => run(() => post(a.id, { action: "created", actual_email: email || a.planned_email, note: memo }))}>作成済みとして記録</Button>
                  <Button size="sm" variant="secondary" onClick={() => setFail({ ...fail, open: !fail.open })}>作成できなかった</Button>
                </div>
                {fail.open && (
                  <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
                    <input className={inputCls} placeholder="作成できなかった理由(Appleの表示内容など)" value={fail.reason} onChange={(e) => setFail({ ...fail, reason: e.target.value })} />
                    <select className={inputCls} value={fail.mark} onChange={(e) => setFail({ ...fail, mark: e.target.value })}>
                      <option value="unusable">番号を使用不可にする</option>
                      <option value="cancelled">取消にする(管理者が再利用を判断)</option>
                    </select>
                    <Button size="sm" variant="danger" disabled={busy} onClick={() => run(() => post(a.id, { action: "failed", reason: fail.reason, mark: fail.mark }))}>記録</Button>
                  </div>
                )}
              </div>
            )}
            {d.perms.canPrepare && (a.status === "reserved" || d.perms.canAdmin) && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-slate-500">この番号を取消す</summary>
                <div className="mt-2 flex gap-2">
                  <input className={inputCls} placeholder="取消の理由(例: 入職辞退)" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
                  <Button size="sm" variant="danger" disabled={busy} onClick={() => run(() => post(a.id, { action: "cancel", reason: cancelReason }))}>取消</Button>
                </div>
              </details>
            )}
          </div>
        )}
        {d.apple.filter((x) => x.id !== a?.id).length > 0 && (
          <div className="text-xs text-slate-500">
            <p className="font-semibold">過去の番号</p>
            <ul className="list-disc pl-5">
              {d.apple.filter((x) => x.id !== a?.id).map((x) => (
                <li key={x.id}>{pad3(x.number)} {x.planned_email}:{APPLE_STATUS_LABELS[x.status as AppleStatus]} {x.failure_reason ?? x.cancel_reason ?? ""}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// 端末
// ---------------------------------------------------------------------------

export function DevicesPanel({ d }: { d: HireDetail }) {
  return (
    <Card title="貸与するiPhone・iPad" id="devices" actions={<Link href={`/onboarding/devices?hire=${d.hire.id}`} className="text-sm font-semibold text-teal-700 hover:underline">端末台帳で登録・編集 →</Link>}>
      {d.devices.length === 0 ? <Empty>まだ端末が割り当てられていません。端末台帳で登録してください。</Empty> : (
        <div className="grid gap-3 md:grid-cols-2">
          {d.devices.map((v) => (
            <div key={v.id} className="rounded-lg border border-slate-200 p-3 text-sm">
              <div className="flex items-center justify-between">
                <p className="font-bold">{v.kind} <span className="font-normal text-slate-500">{v.asset_no}</span></p>
                <Tag tone={v.lend_status === "lent" ? "teal" : "slate"}>{LEND_STATUS_LABELS[v.lend_status as LendStatus]}</Tag>
              </div>
              <dl className="mt-2 grid grid-cols-[7rem_1fr] gap-y-0.5 text-xs">
                <dt className="text-slate-500">機種</dt><dd>{v.model ?? "—"}</dd>
                <dt className="text-slate-500">シリアル</dt><dd>{v.serial ?? "—"}</dd>
                {v.kind === "iPhone" && (<><dt className="text-slate-500">電話番号</dt><dd>{v.phone_number ?? "—"}</dd></>)}
                <dt className="text-slate-500">Apple Account</dt><dd>{v.apple_actual_email ?? v.apple_planned_email ?? <Unset />}</dd>
                <dt className="text-slate-500">認証コード受信先</dt><dd>{v.auth_code_destination ?? <Unset />}</dd>
                <dt className="text-slate-500">認証先の管理者</dt><dd>{v.auth_manager_name ?? <Unset />}</dd>
                {"passcode_ref" in v && (<><dt className="text-slate-500">パスコード参照先</dt><dd>{v.passcode_ref ?? <Unset />}</dd></>)}
                <dt className="text-slate-500">貸与日</dt><dd>{fmtDate(v.lent_date) || "—"}</dd>
              </dl>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// サービス別の配置・ログイン確認
// ---------------------------------------------------------------------------

export function ServicesPanel({ d, reload }: P) {
  const { run, busy, msg } = useAction();
  const me = useMe();
  const patch = (id: number, body: Record<string, unknown>) => run(() => api(`/hire-services/${id}`, { method: "PATCH", body }).then(reload));
  const reqStatus = (sid: number) => d.requests.find((r) => r.service_id === sid);
  const can = d.perms.canPrepare;
  return (
    <Card title="サービス(配置・ログイン・内容確認)" id="services">
      <p className="mb-2 text-xs text-slate-500">
        iPhone・iPadそれぞれで「配置(アプリ入手/ホーム画面追加)」「ログイン確認」を記録します。個別発行が必要なサービスは、発行済みになってからログイン確認できます。AirDropで共有するのは入手リンクやURLのみで、アプリ本体は移送しません。
      </p>
      {msg}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="border-b border-slate-200 text-left text-xs text-slate-500">
            <tr>
              <th className="py-2 pr-2">サービス</th><th className="pr-2">区分</th><th className="pr-2">配置方式・URL</th><th className="pr-2">アカウント</th>
              <th className="pr-2 text-center">配置<br />iPhone / iPad</th><th className="pr-2 text-center">ログイン確認<br />iPhone / iPad</th><th className="text-center">内容確認</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {d.services.map((s) => {
              const req = reqStatus(s.service_id);
              const notUsed = s.requirement === "confirm" && s.usage_decision !== "use";
              const loginBlocked = !!s.needs_issuance && (!req || !["issued", "login_confirmed"].includes(req.status));
              return (
                <tr key={s.id} className={notUsed ? "bg-slate-50 text-slate-400" : ""}>
                  <td className="py-2 pr-2 font-semibold">{s.name}</td>
                  <td className="pr-2">
                    <Tag tone={s.requirement === "required" ? "teal" : s.requirement === "confirm" ? "amber" : "slate"}>{REQUIREMENT_LABELS[s.requirement as Requirement]}</Tag>
                    {s.requirement === "confirm" && (
                      me.actor.role === "admin" ? (
                        <select className="mt-1 block rounded border border-slate-300 px-1 py-0.5 text-xs" value={s.usage_decision ?? "pending"} onChange={(e) => patch(s.id, { usage_decision: e.target.value })} disabled={busy}>
                          <option value="pending">要否未確認</option><option value="use">使用する</option><option value="not_use">使用しない</option>
                        </select>
                      ) : <div className="text-[11px]">{s.usage_decision === "use" ? "使用する" : s.usage_decision === "not_use" ? "使用しない" : "要否未確認(管理者が判断)"}</div>
                    )}
                  </td>
                  <td className="pr-2 text-xs">
                    {s.placement_confirmed ? PLACEMENT_LABELS[s.placement as Placement] : <Unset>配置方式 未確定</Unset>}
                    {s.url && <div><a href={s.url} target="_blank" rel="noreferrer" className="text-teal-700 underline">WebのURL</a></div>}
                    {s.app_store_url && <div><a href={s.app_store_url} target="_blank" rel="noreferrer" className="text-teal-700 underline">App Store</a></div>}
                  </td>
                  <td className="pr-2 text-xs">
                    {s.account_type === "unset" ? <Unset /> : ACCOUNT_TYPE_LABELS[s.account_type as AccountType]}
                    {s.account_type === "company_google" && d.perms.canPrepare && <div className="text-slate-500">会社Googleアカウント</div>}
                    {req && <div><Tag tone={req.status === "login_confirmed" ? "teal" : req.status === "issued" ? "sky" : "amber"}>{REQUEST_STATUS_LABELS[req.status as RequestStatus]}</Tag></div>}
                  </td>
                  <td className="pr-2 text-center">
                    <div className="flex justify-center gap-3">
                      <Check checked={!!s.iphone_placed_at} disabled={!can || busy || notUsed || !s.iphone_target} onChange={(v) => patch(s.id, { iphone_placed: v })} label="iPhone" />
                      <Check checked={!!s.ipad_placed_at} disabled={!can || busy || notUsed || !s.ipad_target} onChange={(v) => patch(s.id, { ipad_placed: v })} label="iPad" />
                    </div>
                  </td>
                  <td className="pr-2 text-center">
                    <div className="flex justify-center gap-3" title={loginBlocked ? "アカウントが発行済みになってから記録できます" : ""}>
                      <Check checked={!!s.iphone_login_at} disabled={!can || busy || notUsed || !s.iphone_target || (loginBlocked && !s.iphone_login_at)} onChange={(v) => patch(s.id, { iphone_login: v })} label="iPhone" />
                      <Check checked={!!s.ipad_login_at} disabled={!can || busy || notUsed || !s.ipad_target || (loginBlocked && !s.ipad_login_at)} onChange={(v) => patch(s.id, { ipad_login: v })} label="iPad" />
                    </div>
                    {loginBlocked && !notUsed && <div className="text-[10px] text-amber-700">発行待ち</div>}
                  </td>
                  <td className="text-center">
                    <Check checked={!!s.verified_at} disabled={!can || busy || notUsed} onChange={(v) => patch(s.id, { verified: v })} label="確認済み" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {d.perms.canAdmin && <AddServiceRow hireId={d.hire.id} reload={reload} />}
    </Card>
  );
}

function AddServiceRow({ hireId, reload }: { hireId: number; reload: () => void }) {
  const [list, setList] = useState<{ id: number; name: string; requirement: string }[] | null>(null);
  const { run, busy, msg } = useAction();
  return (
    <details className="mt-3 text-sm" onToggle={(e) => { if ((e.target as HTMLDetailsElement).open && !list) api<typeof list>(`/hires/${hireId}/missing-services`).then(setList); }}>
      <summary className="cursor-pointer text-xs text-slate-500">部門の標準に後から追加されたサービスをこの入職者に追加する(管理者)</summary>
      <div className="mt-2 space-y-2">
        {msg}
        {list && list.length === 0 && <p className="text-xs text-slate-500">追加できるサービスはありません。</p>}
        {list?.map((s) => (
          <div key={s.id} className="flex items-center gap-2">
            <span>{s.name}({REQUIREMENT_LABELS[s.requirement as Requirement]})</span>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(() => api(`/hires/${hireId}/services`, { method: "POST", body: { service_id: s.id, requirement: s.requirement } }).then(() => { setList(list.filter((x) => x.id !== s.id)); reload(); }))}>追加</Button>
          </div>
        ))}
      </div>
    </details>
  );
}

// ---------------------------------------------------------------------------
// アカウント発行依頼
// ---------------------------------------------------------------------------

export function RequestsPanel({ d, reload }: P) {
  const me = useMe();
  const { run, busy, msg, setMsg } = useAction();
  const [sel, setSel] = useState<number[]>([]);
  const [draft, setDraft] = useState<{ text: string; warnings: string[] } | null>(null);
  const [rec, setRec] = useState({ requested_to: "", request_method: "LINE WORKS", requested_at: todayLocal() });
  const [issue, setIssue] = useState<Record<number, { issued_at: string; issued_login_id: string }>>({});
  const openReqs = d.requests.filter((r) => r.status === "not_requested");
  const canIssue = (r: HireDetail["requests"][number]) =>
    d.perms.canPrepare || (me.actor.role === "issuer" && (r.issuer_user_id === me.actor.id || r.deputy_user_id === me.actor.id));
  const toggle = (id: number) => setSel(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);

  return (
    <Card title="アカウント発行依頼" id="requests">
      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500">確定したメールアドレス:</span>
          {d.confirmedEmail ? <b>{d.confirmedEmail}</b> : <Tag tone="amber">未確定(Appleアカウントを「作成済み」にすると確定します)</Tag>}
        </div>
        {msg}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-slate-200 text-left text-xs text-slate-500">
              <tr><th className="py-2 pr-2"></th><th className="pr-2">サービス</th><th className="pr-2">発行担当</th><th className="pr-2">状態</th><th className="pr-2">発行希望日</th><th className="pr-2">依頼</th><th className="pr-2">発行</th><th>ログイン確認</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {d.requests.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="py-2 pr-2">
                    {r.status === "not_requested" && d.perms.canPrepare && <input type="checkbox" className="h-4 w-4 accent-teal-600" checked={sel.includes(r.id)} onChange={() => toggle(r.id)} />}
                  </td>
                  <td className="pr-2 font-semibold">
                    {r.service_name}
                    {r.requires_email ? <div className="text-[10px] font-normal text-slate-500">メール確定後に依頼</div> : null}
                  </td>
                  <td className="pr-2 text-xs">
                    {r.issuer_name ?? r.issuer_label ?? <Unset />}
                    {r.issuer_label && r.issuer_name && <div className="text-slate-500">({r.issuer_label})</div>}
                    {!r.issuer_name && <div><Unset>担当ユーザー未設定</Unset></div>}
                    {r.owner_mode === "enomoto" && <div><Tag tone="rose">榎本対応(移管前)</Tag></div>}
                  </td>
                  <td className="pr-2"><Tag tone={r.status === "login_confirmed" ? "teal" : r.status === "issued" ? "sky" : r.status === "requested" ? "violet" : "amber"}>{REQUEST_STATUS_LABELS[r.status as RequestStatus]}</Tag></td>
                  <td className="pr-2 text-xs">{fmtDate(r.desired_date)}</td>
                  <td className="pr-2 text-xs">{r.requested_at ? <>{fmtDate(r.requested_at)}<div className="text-slate-500">{r.requested_to}/{r.request_method}</div></> : "—"}</td>
                  <td className="pr-2 text-xs">
                    {r.issued_at ? <>{fmtDate(r.issued_at)}<div className="text-slate-500">ID: {r.issued_login_id}</div></> : r.status === "requested" && canIssue(r) ? (
                      <div className="space-y-1">
                        <input type="date" className="w-36 rounded border border-slate-300 px-1 py-0.5" value={issue[r.id]?.issued_at ?? todayLocal()} onChange={(e) => setIssue({ ...issue, [r.id]: { issued_at: e.target.value, issued_login_id: issue[r.id]?.issued_login_id ?? "" } })} />
                        <input className="w-36 rounded border border-slate-300 px-1 py-0.5" placeholder="発行されたID" value={issue[r.id]?.issued_login_id ?? ""} onChange={(e) => setIssue({ ...issue, [r.id]: { issued_at: issue[r.id]?.issued_at ?? todayLocal(), issued_login_id: e.target.value } })} />
                        <Button size="sm" disabled={busy} onClick={() => run(() => api(`/requests/${r.id}`, { method: "PATCH", body: { action: "issued", issued_at: issue[r.id]?.issued_at ?? todayLocal(), issued_login_id: issue[r.id]?.issued_login_id } }).then(reload))}>発行済みにする</Button>
                        <p className="text-[10px] text-slate-500">IDのみ記録。パスワードは入力しない</p>
                      </div>
                    ) : "—"}
                  </td>
                  <td className="text-xs">{r.login_confirmed_at ? fmtDate(r.login_confirmed_at) : r.status === "issued" ? <span className="text-slate-500">サービス表で両端末のログイン確認を記録</span> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {d.perms.canPrepare && openReqs.length > 0 && (
          <div className="space-y-3 rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-700">
              ① 依頼するサービスにチェック → ② 依頼文を作成してコピー → ③ LINE WORKS等で送る → ④ 依頼した記録をつける
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => setSel(openReqs.map((r) => r.id))}>未依頼をすべて選択</Button>
              <Button size="sm" disabled={busy || sel.length === 0} onClick={() => run(async () => setDraft(await api(`/hires/${d.hire.id}/request-text`, { method: "POST", body: { request_ids: sel } })))}>
                依頼文を作成
              </Button>
            </div>
            {draft && (
              <div className="space-y-2">
                {draft.warnings.map((w) => <Alert key={w} tone="warn">{w}</Alert>)}
                <textarea className={`${inputCls} font-mono text-xs`} rows={14} value={draft.text} readOnly />
                <Button size="sm" variant="secondary" onClick={() => navigator.clipboard.writeText(draft.text).then(() => setMsg({ tone: "success", text: "依頼文をコピーしました。まだ「依頼した記録」はついていません。" }))}>
                  依頼文をコピー
                </Button>
              </div>
            )}
            <div className="grid gap-2 md:grid-cols-4">
              <Field label="依頼先" required><input className={inputCls} value={rec.requested_to} onChange={(e) => setRec({ ...rec, requested_to: e.target.value })} placeholder="例: 事務 ○○さん" /></Field>
              <Field label="依頼方法"><input className={inputCls} value={rec.request_method} onChange={(e) => setRec({ ...rec, request_method: e.target.value })} /></Field>
              <Field label="依頼日"><input type="date" className={inputCls} value={rec.requested_at} onChange={(e) => setRec({ ...rec, requested_at: e.target.value })} /></Field>
              <div className="flex items-end">
                <Button disabled={busy || sel.length === 0} onClick={() => run(() => api(`/hires/${d.hire.id}/request-record`, { method: "POST", body: { request_ids: sel, ...rec } }).then(() => { setSel([]); setDraft(null); reload(); }), "依頼した記録をつけました。")}>
                  依頼した記録をつける
                </Button>
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              このツールからメールやLINE WORKSへの自動送信は行いません。各サービスのパスワードは別途管理者が設定します(Appleのパスワードは流用しない)。
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// 未完了項目・認証情報の参照先・履歴
// ---------------------------------------------------------------------------

export function OpenItemsPanel({ d }: { d: HireDetail }) {
  return (
    <Card title={`未完了項目(${d.openItems.length}件)`} id="open">
      {d.openItems.length === 0 ? <Empty>未完了の項目はありません。</Empty> : (
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-xs text-slate-500"><tr><th className="py-1.5">種類</th><th>項目</th><th>対応者</th><th>期限</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {d.openItems.map((o, i) => (
              <tr key={i}>
                <td className="whitespace-nowrap py-1.5 pr-2 text-xs">{o.kind}</td>
                <td>{o.title}{o.requirement === "optional" && <Tag>任意</Tag>}</td>
                <td className="text-xs">{o.assignee ?? <Unset />}</td>
                <td className={`text-xs ${o.overdue ? "font-semibold text-rose-700" : ""}`}>{o.due ? fmtDate(o.due) : <Unset />}{o.overdue && " 超過"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

export function CredentialsPanel({ d, reload }: P) {
  const { run, busy, msg } = useAction();
  const [v, setV] = useState({ label: "", ref_location: "" });
  if (!d.credentials) return null;
  return (
    <Card title="認証情報の参照先(準備担当者・管理者のみ表示)" id="credentials">
      <div className="space-y-2 text-sm">
        <Alert tone="warn">
          パスワード・端末パスコードの実際の値はここに入力しないでください。会社の認証情報管理ツールのどこに保管したか(保管庫・項目名)だけを記録します。
        </Alert>
        {msg}
        {d.credentials.length === 0 ? <Empty>登録されていません。</Empty> : (
          <ul className="divide-y divide-slate-100">
            {d.credentials.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 py-1.5">
                <span><b>{c.label}</b>:{c.ref_location}<span className="ml-2 text-[11px] text-slate-400">{fmtDate(c.created_at)} {c.created_by_name}</span></span>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => api(`/credentials/${c.id}`, { method: "DELETE", body: {} }).then(reload))}>削除</Button>
              </li>
            ))}
          </ul>
        )}
        <div className="grid gap-2 md:grid-cols-[1fr_2fr_auto]">
          <input className={inputCls} placeholder="項目名(例: Apple Account 復旧キー)" value={v.label} onChange={(e) => setV({ ...v, label: e.target.value })} />
          <input className={inputCls} placeholder="参照先(例: 認証情報管理ツール 保管庫「入職者」> 項目名)" value={v.ref_location} onChange={(e) => setV({ ...v, ref_location: e.target.value })} />
          <Button disabled={busy} onClick={() => run(() => api(`/hires/${d.hire.id}/credentials`, { method: "POST", body: v }).then(() => { setV({ label: "", ref_location: "" }); reload(); }))}>登録</Button>
        </div>
      </div>
    </Card>
  );
}

export function HistoryPanel({ d }: { d: HireDetail }) {
  if (!d.history.length) return null;
  return (
    <Card title="変更履歴" id="history">
      <details>
        <summary className="cursor-pointer text-sm text-slate-600">{d.history.length}件の履歴を表示</summary>
        <ul className="mt-2 max-h-96 divide-y divide-slate-100 overflow-y-auto text-xs">
          {d.history.map((h, i) => (
            <li key={i} className="py-1.5">
              <span className="text-slate-500">{fmtDate(h.at)}</span> <b>{h.user_name}</b> {h.action}
              {h.detail && <HistoryDetail detail={h.detail} />}
            </li>
          ))}
        </ul>
      </details>
    </Card>
  );
}

export function HistoryDetail({ detail }: { detail: string }) {
  let obj: Record<string, unknown>;
  try { obj = JSON.parse(detail); } catch { return <span className="ml-2 text-slate-500">{detail}</span>; }
  return (
    <span className="ml-2 text-slate-500">
      {Object.entries(obj).map(([k, v]) => {
        const val = v && typeof v === "object" && "before" in (v as object)
          ? `${String((v as { before: unknown }).before ?? "なし")} → ${String((v as { after: unknown }).after ?? "なし")}`
          : Array.isArray(v) ? v.join("、") : String(v ?? "");
        return <span key={k} className="mr-2">[{k}: {val}]</span>;
      })}
    </span>
  );
}
