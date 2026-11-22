"use client";

import { FormEvent, useMemo, useState } from "react";
import { usePortalStore, useCurrentStaff, useStaffName } from "@/lib/portal/store";
import { BUSINESS_UNITS } from "@/lib/portal/defaults";
import { BusinessUnitId, SalesActivity, SalesMethod, SalesOrgType, SalesResult } from "@/lib/portal/types";
import { downloadCsv, formatDate, newId, nowIsoLocal, todayString } from "@/lib/portal/util";
import {
  Card,
  EmptyState,
  Field,
  PageContainer,
  PageHeader,
  StaffSelect,
  StatusPill,
  UnitBadge,
  UnitFilter,
  buttonClass,
  inputClass,
} from "@/components/portal/ui";

const ORG_TYPES: SalesOrgType[] = ["病院(地域連携室)", "診療所・クリニック", "居宅介護支援事業所", "地域包括支援センター", "訪問看護・介護事業所", "行政", "その他"];
const METHODS: SalesMethod[] = ["訪問", "電話", "オンライン", "メール・FAX", "その他"];
const RESULTS: SalesResult[] = ["情報提供", "依頼あり", "検討中", "関係構築", "その他"];

type Form = Omit<SalesActivity, "id" | "createdAt">;

export default function SalesPage() {
  const activities = usePortalStore((s) => s.salesActivities);
  const staff = usePortalStore((s) => s.staff);
  const collection = usePortalStore((s) => s.collection);
  const current = useCurrentStaff();
  const staffName = useStaffName();

  const blank = (): Form => ({
    date: todayString(),
    staffId: current?.id ?? "",
    unitId: current?.unitId ?? "houkan",
    orgName: "",
    orgType: "病院(地域連携室)",
    contactPerson: "",
    method: "訪問",
    content: "",
    result: "情報提供",
    referrals: 0,
    nextAction: "",
    nextDate: "",
  });

  const [form, setForm] = useState<Form>(blank);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [month, setMonth] = useState(todayString().slice(0, 7));
  const [unit, setUnit] = useState<BusinessUnitId | "all">("all");
  const [staffFilter, setStaffFilter] = useState("");

  const orgNames = useMemo(() => [...new Set(activities.map((a) => a.orgName))], [activities]);

  function pickOrg(name: string) {
    const prev = activities.find((a) => a.orgName === name);
    setForm((f) => ({ ...f, orgName: name, ...(prev ? { orgType: prev.orgType, contactPerson: f.contactPerson || prev.contactPerson } : {}) }));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (editingId) collection("salesActivities").update(editingId, form);
    else collection("salesActivities").add({ ...form, id: newId("sa"), createdAt: nowIsoLocal() });
    setEditingId(null);
    setShowForm(false);
    setForm(blank());
  }

  const inUnit = (a: SalesActivity) => unit === "all" || a.unitId === unit;
  const filtered = useMemo(
    () =>
      activities
        .filter((a) => a.date.startsWith(month) && inUnit(a) && (!staffFilter || a.staffId === staffFilter))
        .sort((a, b) => b.date.localeCompare(a.date)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activities, month, unit, staffFilter]
  );

  const byOrg = useMemo(() => {
    const map = new Map<string, { type: SalesOrgType; count: number; referrals: number; last: string }>();
    for (const a of filtered) {
      const x = map.get(a.orgName) ?? { type: a.orgType, count: 0, referrals: 0, last: "" };
      x.count += 1;
      x.referrals += a.referrals;
      x.last = a.date > x.last ? a.date : x.last;
      map.set(a.orgName, x);
    }
    return [...map.entries()].sort((a, b) => b[1].referrals - a[1].referrals || b[1].count - a[1].count);
  }, [filtered]);

  const byStaff = useMemo(() => {
    const map = new Map<string, { count: number; referrals: number }>();
    for (const a of filtered) {
      const x = map.get(a.staffId) ?? { count: 0, referrals: 0 };
      x.count += 1;
      x.referrals += a.referrals;
      map.set(a.staffId, x);
    }
    return [...map.entries()].sort((a, b) => b[1].referrals - a[1].referrals);
  }, [filtered]);

  const upcoming = activities
    .filter((a) => a.nextDate && a.nextDate >= todayString() && inUnit(a))
    .sort((a, b) => a.nextDate.localeCompare(b.nextDate))
    .slice(0, 8);

  const totalReferrals = filtered.reduce((s, a) => s + a.referrals, 0);

  function exportCsv() {
    downloadCsv(
      `営業管理表_${month}.csv`,
      ["日付", "担当", "事業所", "訪問先", "種別", "先方担当者", "方法", "内容", "結果", "紹介件数", "次のアクション", "次回予定日"],
      filtered.map((a) => [
        a.date,
        staffName(a.staffId),
        BUSINESS_UNITS.find((u) => u.id === a.unitId)?.name,
        a.orgName,
        a.orgType,
        a.contactPerson,
        a.method,
        a.content,
        a.result,
        a.referrals,
        a.nextAction,
        a.nextDate,
      ])
    );
  }

  return (
    <PageContainer>
      <PageHeader
        icon="🤝"
        title="営業管理表"
        description="病院・居宅・診療所などへの営業活動と、紹介・依頼の件数を記録します。"
        actions={
          <button
            type="button"
            className={buttonClass.primary}
            onClick={() => {
              setEditingId(null);
              setForm(blank());
              setShowForm(true);
            }}
          >
            ＋ 活動を記録
          </button>
        }
      />

      {showForm && (
        <Card className="mb-5 border-teal-300">
          <form onSubmit={submit} className="space-y-4">
            <h2 className="text-sm font-bold text-slate-900">{editingId ? "営業活動を編集" : "営業活動を記録"}</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Field label="日付" required>
                <input type="date" className={inputClass} required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </Field>
              <Field label="担当" required>
                <StaffSelect staff={staff.filter((s) => s.active)} value={form.staffId} onChange={(v) => setForm({ ...form, staffId: v })} required />
              </Field>
              <Field label="事業所">
                <select className={inputClass} value={form.unitId} onChange={(e) => setForm({ ...form, unitId: e.target.value as BusinessUnitId })}>
                  {BUSINESS_UNITS.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="方法">
                <select className={inputClass} value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value as SalesMethod })}>
                  {METHODS.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </Field>
              <Field label="訪問先(機関名)" required className="col-span-2" hint="過去に入力した機関は候補に出ます">
                <input className={inputClass} required list="sales-orgs" value={form.orgName} onChange={(e) => pickOrg(e.target.value)} />
                <datalist id="sales-orgs">
                  {orgNames.map((o) => (
                    <option key={o} value={o} />
                  ))}
                </datalist>
              </Field>
              <Field label="種別">
                <select className={inputClass} value={form.orgType} onChange={(e) => setForm({ ...form, orgType: e.target.value as SalesOrgType })}>
                  {ORG_TYPES.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </Field>
              <Field label="先方の担当者">
                <input className={inputClass} value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
              </Field>
              <Field label="内容" className="col-span-2 md:col-span-4">
                <textarea className={`${inputClass} min-h-20`} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
              </Field>
              <Field label="結果">
                <select className={inputClass} value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value as SalesResult })}>
                  {RESULTS.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </Field>
              <Field label="新規の紹介・依頼件数">
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={form.referrals}
                  onChange={(e) => setForm({ ...form, referrals: Math.max(0, Number(e.target.value) || 0) })}
                />
              </Field>
              <Field label="次のアクション">
                <input className={inputClass} value={form.nextAction} onChange={(e) => setForm({ ...form, nextAction: e.target.value })} />
              </Field>
              <Field label="次回予定日">
                <input type="date" className={inputClass} value={form.nextDate} onChange={(e) => setForm({ ...form, nextDate: e.target.value })} />
              </Field>
            </div>
            <div className="flex gap-2">
              <button type="submit" className={buttonClass.primary}>
                保存する
              </button>
              <button type="button" className={buttonClass.secondary} onClick={() => setShowForm(false)}>
                キャンセル
              </button>
            </div>
          </form>
        </Card>
      )}

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <UnitFilter value={unit} onChange={setUnit} />
        <div className="flex flex-wrap gap-2">
          <input type="month" className={`${inputClass} w-auto`} value={month} onChange={(e) => setMonth(e.target.value)} />
          <select className={`${inputClass} w-auto`} value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}>
            <option value="">担当: すべて</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button type="button" className={buttonClass.secondary} onClick={exportCsv}>
            CSV出力
          </button>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <h2 className="text-sm font-bold text-slate-900">{month.replace("-", "年")}月の実績</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-[11px] text-slate-500">活動件数</p>
              <p className="text-2xl font-bold text-slate-900">{filtered.length}</p>
            </div>
            <div className="rounded-lg bg-teal-50 p-3">
              <p className="text-[11px] text-teal-700">紹介・依頼</p>
              <p className="text-2xl font-bold text-teal-700">{totalReferrals}</p>
            </div>
          </div>
          {byStaff.length > 0 && (
            <ul className="mt-3 divide-y divide-slate-100 text-sm">
              {byStaff.map(([id, x]) => (
                <li key={id} className="flex justify-between py-1.5">
                  <span>{staffName(id)}</span>
                  <span className="text-slate-500">
                    {x.count}件 ・ 紹介 <span className="font-bold text-slate-800">{x.referrals}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="lg:col-span-2">
          <h2 className="text-sm font-bold text-slate-900">今後の予定(次のアクション)</h2>
          {upcoming.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">予定はありません。</p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-100 text-sm">
              {upcoming.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-2">
                  <span className="w-28 shrink-0 font-semibold text-teal-700">{formatDate(a.nextDate)}</span>
                  <span className="font-medium text-slate-800">{a.orgName}</span>
                  <span className="text-slate-500">{a.nextAction}</span>
                  <span className="ml-auto text-xs text-slate-400">{staffName(a.staffId)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {byOrg.length > 0 && (
        <Card className="mb-5">
          <h2 className="mb-2 text-sm font-bold text-slate-900">訪問先別(紹介件数の多い順)</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  {["訪問先", "種別", "活動", "紹介・依頼", "最終接触"].map((h) => (
                    <th key={h} className="px-2 py-1.5 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {byOrg.map(([name, x]) => (
                  <tr key={name}>
                    <td className="px-2 py-1.5 font-medium">{name}</td>
                    <td className="px-2 py-1.5 text-xs text-slate-500">{x.type}</td>
                    <td className="px-2 py-1.5">{x.count}</td>
                    <td className="px-2 py-1.5 font-bold text-teal-700">{x.referrals}</td>
                    <td className="px-2 py-1.5 text-xs">{formatDate(x.last)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <h2 className="mb-2 text-base font-bold text-slate-900">活動一覧</h2>
      {filtered.length === 0 ? (
        <EmptyState>この月の営業活動はありません。</EmptyState>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => (
            <Card key={a.id} className="p-3 sm:p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">{formatDate(a.date)}</span>
                <UnitBadge unitId={a.unitId} />
                <span className="text-sm font-bold text-slate-900">{a.orgName}</span>
                <span className="text-xs text-slate-400">
                  {a.orgType}
                  {a.contactPerson && ` ・ ${a.contactPerson}`}
                </span>
                <span className="ml-auto flex items-center gap-1">
                  <StatusPill tone={a.result === "依頼あり" ? "ok" : a.result === "検討中" ? "warn" : "neutral"}>{a.result}</StatusPill>
                  {a.referrals > 0 && <StatusPill tone="info">紹介 {a.referrals}件</StatusPill>}
                </span>
              </div>
              {a.content && <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-700">{a.content}</p>}
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span>
                  {staffName(a.staffId)} ・ {a.method}
                  {a.nextAction && ` ・ 次: ${a.nextAction}${a.nextDate ? `(${formatDate(a.nextDate)})` : ""}`}
                </span>
                <span>
                  <button
                    type="button"
                    className={buttonClass.ghost}
                    onClick={() => {
                      // eslint-disable-next-line @typescript-eslint/no-unused-vars
                      const { id, createdAt, ...rest } = a;
                      setEditingId(id);
                      setForm(rest);
                      setShowForm(true);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    編集
                  </button>
                  <button
                    type="button"
                    className={buttonClass.danger}
                    onClick={() => confirm("この活動記録を削除しますか?") && collection("salesActivities").remove(a.id)}
                  >
                    削除
                  </button>
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
