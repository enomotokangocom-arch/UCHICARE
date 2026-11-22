"use client";

import { FormEvent, useMemo, useState } from "react";
import clsx from "clsx";
import { usePortalStore, useCurrentStaff } from "@/lib/portal/store";
import { nanbyoMonthSummary, suggestedCopay, yen } from "@/lib/portal/logic";
import { BUSINESS_UNITS } from "@/lib/portal/defaults";
import { BusinessUnitId, NanbyoPatient } from "@/lib/portal/types";
import { addMonths, formatDate, newId, nowIsoLocal, todayString } from "@/lib/portal/util";
import { Card, EmptyState, Field, PageContainer, PageHeader, StatusPill, buttonClass, inputClass } from "@/components/portal/ui";

const CAP_PRESETS = [0, 1000, 2500, 5000, 10000, 20000, 30000];
const SELF_PROVIDER = "当ステーション";

type PatientForm = Omit<NanbyoPatient, "id">;

function blankPatient(unitId: BusinessUnitId): PatientForm {
  return { name: "", unitId, recipientNumber: "", validFrom: "", validTo: "", monthlyCap: 10000, burdenRate: 0.2, notes: "", active: true };
}

function validity(p: NanbyoPatient, today = todayString()) {
  if (!p.validTo) return null;
  if (p.validTo < today) return { tone: "danger" as const, label: "受給者証 期限切れ" };
  if (p.validTo <= addMonths(today, 2)) return { tone: "warn" as const, label: "受給者証 更新が近い" };
  return null;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

function PatientFormCard({ initial, onSave, onCancel }: { initial: PatientForm; onSave: (f: PatientForm) => void; onCancel: () => void }) {
  const [f, setF] = useState(initial);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(f);
      }}
      className="space-y-4 rounded-xl border border-teal-300 bg-white p-4"
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Field label="表示名" required hint="イニシャルや利用者番号を推奨" className="col-span-2">
          <input className={inputClass} required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="受給者番号">
          <input className={inputClass} value={f.recipientNumber} onChange={(e) => setF({ ...f, recipientNumber: e.target.value })} />
        </Field>
        <Field label="事業所">
          <select className={inputClass} value={f.unitId} onChange={(e) => setF({ ...f, unitId: e.target.value as BusinessUnitId })}>
            {BUSINESS_UNITS.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="有効期間(開始)">
          <input type="date" className={inputClass} value={f.validFrom} onChange={(e) => setF({ ...f, validFrom: e.target.value })} />
        </Field>
        <Field label="有効期間(終了)">
          <input type="date" className={inputClass} value={f.validTo} onChange={(e) => setF({ ...f, validTo: e.target.value })} />
        </Field>
        <Field label="月額自己負担上限額(円)" required hint="受給者証に記載の金額">
          <input
            type="number"
            min={0}
            list="cap-presets"
            className={inputClass}
            required
            value={f.monthlyCap}
            onChange={(e) => setF({ ...f, monthlyCap: Number(e.target.value) || 0 })}
          />
          <datalist id="cap-presets">
            {CAP_PRESETS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="負担割合">
          <select className={inputClass} value={f.burdenRate} onChange={(e) => setF({ ...f, burdenRate: Number(e.target.value) })}>
            <option value={0.2}>2割</option>
            <option value={0.1}>1割</option>
            <option value={0.3}>3割</option>
            <option value={0}>負担なし</option>
          </select>
        </Field>
        <Field label="備考" className="col-span-2 md:col-span-4">
          <input className={inputClass} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
      </div>
      <div className="flex gap-2">
        <button type="submit" className={buttonClass.primary}>
          保存する
        </button>
        <button type="button" className={buttonClass.secondary} onClick={onCancel}>
          キャンセル
        </button>
      </div>
    </form>
  );
}

export default function NanbyoPage() {
  const patients = usePortalStore((s) => s.nanbyoPatients);
  const entries = usePortalStore((s) => s.nanbyoEntries);
  const collection = usePortalStore((s) => s.collection);
  const current = useCurrentStaff();

  const [month, setMonth] = useState(todayString().slice(0, 7));
  const [selectedId, setSelectedId] = useState<string | null>(patients[0]?.id ?? null);
  const [patientEditing, setPatientEditing] = useState<string | "new" | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [entry, setEntry] = useState({ date: todayString(), provider: SELF_PROVIDER, totalCost: "", copay: "" });

  const list = patients.filter((p) => showInactive || p.active);
  const selected = patients.find((p) => p.id === selectedId);
  const summary = useMemo(() => (selected ? nanbyoMonthSummary(selected, entries, month) : null), [selected, entries, month]);

  const total = Number(entry.totalCost) || 0;
  const suggestion = selected && summary ? suggestedCopay(total, selected.burdenRate, summary.remaining) : 0;

  function addEntry(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    collection("nanbyoEntries").add({
      id: newId("nbe"),
      patientId: selected.id,
      date: entry.date,
      provider: entry.provider.trim() || SELF_PROVIDER,
      totalCost: total,
      copay: entry.copay === "" ? suggestion : Number(entry.copay),
      createdAt: nowIsoLocal(),
    });
    setEntry({ ...entry, totalCost: "", copay: "" });
  }

  function printSheet() {
    if (!selected || !summary) return;
    const rows = summary.rows
      .map(
        (r) =>
          `<tr><td>${formatDate(r.entry.date)}</td><td>${escapeHtml(r.entry.provider)}</td><td class="n">${yen(r.entry.totalCost)}</td><td class="n">${yen(r.entry.copay)}</td><td class="n">${yen(r.cumulative)}</td></tr>`
      )
      .join("");
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>自己負担上限額管理 ${month}</title>
<style>body{font-family:sans-serif;padding:24px}h1{font-size:18px;text-align:center}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #999;padding:6px 8px;font-size:13px}th{background:#f3f3f3}.n{text-align:right}.info td{border:none;padding:2px 0}</style></head><body>
<h1>自己負担上限額 管理表(${month.replace("-", "年")}月分)</h1>
<table class="info"><tr><td>受給者: ${escapeHtml(selected.name)}</td><td>受給者番号: ${escapeHtml(selected.recipientNumber)}</td><td>月額自己負担上限額: ${yen(selected.monthlyCap)}</td></tr></table>
<table><thead><tr><th>日付</th><th>指定医療機関名</th><th>医療費総額(10割)</th><th>自己負担額</th><th>自己負担の累積額(月額)</th></tr></thead><tbody>${rows}</tbody></table>
<p>${summary.reached ? "上記のとおり月額自己負担上限額に達しました。" : `上限額までの残り: ${yen(summary.remaining)}`}</p>
<p style="font-size:11px;color:#666">※ 本表は社内管理用です。受給者証・自己負担上限額管理票の原本への記載を必ず行ってください。</p></body></html>`);
    w.document.close();
    w.focus();
    w.print();
  }

  return (
    <PageContainer>
      <PageHeader
        icon="📑"
        title="難病 上限管理表"
        description="特定医療費(指定難病)受給者の月額自己負担上限額と、月ごとの累積額を管理します。"
        actions={
          <>
            <input type="month" className={`${inputClass} w-auto`} value={month} onChange={(e) => setMonth(e.target.value)} />
            <button type="button" className={buttonClass.primary} onClick={() => setPatientEditing("new")}>
              ＋ 受給者を追加
            </button>
          </>
        }
      />

      <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
        ⚠ 利用者の個人情報です。表示名はイニシャル・利用者番号などにしてください。実際の上限額管理票(紙・受給者証)への記載も必ず行ってください。
      </p>

      {patientEditing === "new" && (
        <div className="mb-4">
          <PatientFormCard
            initial={blankPatient(current?.unitId ?? "houkan")}
            onCancel={() => setPatientEditing(null)}
            onSave={(f) => {
              const id = newId("nb");
              collection("nanbyoPatients").add({ ...f, id });
              setSelectedId(id);
              setPatientEditing(null);
            }}
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <div className="space-y-2 lg:col-span-2">
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" className="h-4 w-4 accent-teal-600" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            終了した受給者も表示
          </label>
          {list.length === 0 ? (
            <EmptyState>受給者が登録されていません。</EmptyState>
          ) : (
            list.map((p) => {
              const s = nanbyoMonthSummary(p, entries, month);
              const v = validity(p);
              const ratio = p.monthlyCap > 0 ? Math.min(1, s.cumulative / p.monthlyCap) : 1;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className={clsx(
                    "w-full rounded-xl border bg-white p-3 text-left shadow-sm transition hover:border-teal-400",
                    selectedId === p.id ? "border-teal-500 ring-2 ring-teal-500/20" : "border-slate-200",
                    !p.active && "opacity-60"
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="text-sm font-bold text-slate-900">{p.name}</span>
                    <span className="flex gap-1">
                      {v && <StatusPill tone={v.tone}>{v.label}</StatusPill>}
                      {s.reached ? <StatusPill tone="info">上限到達</StatusPill> : null}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    上限 {yen(p.monthlyCap)} ・ 負担 {p.burdenRate * 10}割{p.validTo && ` ・ 〜${formatDate(p.validTo)}`}
                  </p>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className={clsx("h-full rounded-full", s.reached ? "bg-sky-500" : "bg-teal-500")} style={{ width: `${ratio * 100}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-600">
                    今月の累積 <span className="font-bold">{yen(s.cumulative)}</span> ・ 残り <span className="font-bold">{yen(s.remaining)}</span>
                  </p>
                </button>
              );
            })
          )}
        </div>

        <div className="lg:col-span-3">
          {!selected || !summary ? (
            <EmptyState>左の一覧から受給者を選んでください。</EmptyState>
          ) : patientEditing === selected.id ? (
            <PatientFormCard
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              initial={(({ id, ...rest }) => rest)(selected)}
              onCancel={() => setPatientEditing(null)}
              onSave={(f) => {
                collection("nanbyoPatients").update(selected.id, f);
                setPatientEditing(null);
              }}
            />
          ) : (
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{selected.name}</h2>
                  <p className="text-xs text-slate-500">
                    受給者番号 {selected.recipientNumber || "-"} ・ 有効期間 {selected.validFrom ? formatDate(selected.validFrom) : "-"} 〜{" "}
                    {selected.validTo ? formatDate(selected.validTo) : "-"}
                  </p>
                  {selected.notes && <p className="text-xs text-slate-400">📝 {selected.notes}</p>}
                </div>
                <div className="flex gap-1">
                  <button type="button" className={buttonClass.ghost} onClick={() => setPatientEditing(selected.id)}>
                    編集
                  </button>
                  <button
                    type="button"
                    className={buttonClass.ghost}
                    onClick={() => collection("nanbyoPatients").update(selected.id, { active: !selected.active })}
                  >
                    {selected.active ? "終了にする" : "再開する"}
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[
                  ["月額上限", yen(selected.monthlyCap)],
                  [`${month.slice(5)}月の累積`, yen(summary.cumulative)],
                  ["上限までの残り", yen(summary.remaining)],
                ].map(([l, v]) => (
                  <div key={l} className="rounded-lg bg-slate-50 p-2">
                    <p className="text-[11px] text-slate-500">{l}</p>
                    <p className="text-base font-bold text-slate-900">{v}</p>
                  </div>
                ))}
              </div>
              {summary.reached && (
                <p className="mt-3 rounded-lg bg-sky-50 p-2 text-sm font-semibold text-sky-700">
                  この月は上限額に達しています。以降の自己負担は0円です。
                </p>
              )}

              <form onSubmit={addEntry} className="mt-5 space-y-3 rounded-lg border border-slate-200 p-3">
                <h3 className="text-sm font-bold text-slate-900">記載を追加</h3>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <Field label="日付" required>
                    <input type="date" className={inputClass} required value={entry.date} onChange={(e) => setEntry({ ...entry, date: e.target.value })} />
                  </Field>
                  <Field label="医療機関等" required>
                    <input
                      className={inputClass}
                      required
                      list="nanbyo-providers"
                      value={entry.provider}
                      onChange={(e) => setEntry({ ...entry, provider: e.target.value })}
                    />
                    <datalist id="nanbyo-providers">
                      {[...new Set([SELF_PROVIDER, ...entries.filter((x) => x.patientId === selected.id).map((x) => x.provider)])].map((p) => (
                        <option key={p} value={p} />
                      ))}
                    </datalist>
                  </Field>
                  <Field label="医療費総額(10割)" required>
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      className={inputClass}
                      required
                      value={entry.totalCost}
                      onChange={(e) => setEntry({ ...entry, totalCost: e.target.value })}
                    />
                  </Field>
                  <Field label="自己負担額" hint={`目安 ${yen(suggestion)}(空欄なら目安を記録)`}>
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      className={inputClass}
                      placeholder={String(suggestion)}
                      value={entry.copay}
                      onChange={(e) => setEntry({ ...entry, copay: e.target.value })}
                    />
                  </Field>
                </div>
                <p className="text-[11px] text-slate-400">
                  目安 = 医療費総額 × 負担割合(10円未満四捨五入)と、上限額までの残りの少ない方。実際の請求額はレセプト・請求ソフトで確認してください。
                </p>
                <button type="submit" className={buttonClass.primary}>
                  追加する
                </button>
              </form>

              <div className="mt-5 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">{month.replace("-", "年")}月の管理表</h3>
                <button type="button" className={buttonClass.secondary} onClick={printSheet}>
                  🖨 印刷
                </button>
              </div>
              {summary.rows.length === 0 ? (
                <p className="mt-2 text-sm text-slate-400">この月の記載はありません。</p>
              ) : (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500">
                      <tr>
                        {["日付", "医療機関等", "医療費総額", "自己負担額", "累積額", ""].map((h) => (
                          <th key={h} className="px-2 py-2 font-semibold">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {summary.rows.map(({ entry: e, cumulative }) => (
                        <tr key={e.id} className={e.provider === SELF_PROVIDER ? "bg-teal-50/40" : ""}>
                          <td className="whitespace-nowrap px-2 py-2">{formatDate(e.date)}</td>
                          <td className="px-2 py-2">{e.provider}</td>
                          <td className="px-2 py-2 text-right font-mono">{yen(e.totalCost)}</td>
                          <td className="px-2 py-2 text-right font-mono">{yen(e.copay)}</td>
                          <td className="px-2 py-2 text-right font-mono font-bold">{yen(cumulative)}</td>
                          <td className="px-2 py-2 text-right">
                            <button
                              type="button"
                              className={buttonClass.danger}
                              onClick={() => confirm("この記載を削除しますか?") && collection("nanbyoEntries").remove(e.id)}
                            >
                              削除
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
