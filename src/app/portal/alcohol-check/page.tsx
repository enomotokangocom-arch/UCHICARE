"use client";

import { FormEvent, useMemo, useState } from "react";
import { usePortalStore, useCurrentStaff, useStaffName, useVehicleName } from "@/lib/portal/store";
import { alcoholChecksFor, isAlcoholDetected } from "@/lib/portal/logic";
import { AlcoholCheck, AlcoholCheckMethod, AlcoholCheckTiming } from "@/lib/portal/types";
import { downloadCsv, formatDate, newId, nowIsoLocal, nowTimeString, todayString } from "@/lib/portal/util";
import {
  Card,
  EmptyState,
  Field,
  PageContainer,
  PageHeader,
  StaffSelect,
  StatusPill,
  buttonClass,
  inputClass,
} from "@/components/portal/ui";

const METHODS: AlcoholCheckMethod[] = ["対面", "ビデオ通話", "電話", "その他"];

type Form = Omit<AlcoholCheck, "id" | "createdAt">;

function emptyForm(driverId: string, checkerId: string, vehicleId: string): Form {
  const hour = new Date().getHours();
  return {
    date: todayString(),
    time: nowTimeString(),
    driverId,
    vehicleId,
    timing: hour < 13 ? "before" : "after",
    method: "対面",
    detectorUsed: true,
    value: 0,
    checkerId,
    instructions: "",
    notes: "",
  };
}

export default function AlcoholCheckPage() {
  const checks = usePortalStore((s) => s.alcoholChecks);
  const staff = usePortalStore((s) => s.staff);
  const vehicles = usePortalStore((s) => s.vehicles);
  const vehicleLogs = usePortalStore((s) => s.vehicleLogs);
  const collection = usePortalStore((s) => s.collection);
  const current = useCurrentStaff();
  const staffName = useStaffName();
  const vehicleName = useVehicleName();

  const drivers = staff.filter((s) => s.active && s.isDriver);
  const checkers = staff.filter((s) => s.active && s.isSafetyManager);
  const activeVehicles = vehicles.filter((v) => v.active);
  const defaultVehicle = activeVehicles.find((v) => v.unitId === current?.unitId)?.id ?? activeVehicles[0]?.id ?? "";

  const [form, setForm] = useState<Form>(() =>
    emptyForm(current?.isDriver ? current.id : "", checkers[0]?.id ?? "", defaultVehicle)
  );
  const [valueText, setValueText] = useState("0.00");
  /** true の間は、記録ボタンを押した時点の日時を自動で使う */
  const [autoTime, setAutoTime] = useState(true);
  const [saved, setSaved] = useState<string | null>(null);
  const [month, setMonth] = useState(todayString().slice(0, 7));
  const [driverFilter, setDriverFilter] = useState("");
  const [summaryDate, setSummaryDate] = useState(todayString());

  const detected = form.value > 0;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.detectorUsed && !confirm("アルコール検知器を使用していません。このまま記録しますか?")) return;
    // 日時を手で変えていなければ、記録したタイミングの日時を自動で入れる
    const stamped = autoTime ? { ...form, date: todayString(), time: nowTimeString() } : form;
    const record: AlcoholCheck = { ...stamped, id: newId("ac"), createdAt: nowIsoLocal() };
    collection("alcoholChecks").add(record);
    setSaved(
      isAlcoholDetected(record)
        ? "⚠ アルコールが検知されました。運転は禁止です。直ちに安全運転管理者へ報告してください。"
        : `${staffName(record.driverId)} さんの${record.timing === "before" ? "運転前" : "運転後"}チェックを記録しました。`
    );
    setForm({ ...form, date: todayString(), time: nowTimeString(), timing: form.timing === "before" ? "after" : "before", instructions: "", notes: "" });
    setAutoTime(true);
  }

  const filtered = useMemo(
    () =>
      checks
        .filter((c) => c.date.startsWith(month) && (!driverFilter || c.driverId === driverFilter))
        .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`)),
    [checks, month, driverFilter]
  );

  // 指定日に運行記録がある、またはチェック記録がある運転者ごとの実施状況
  const summary = useMemo(() => {
    const ids = new Set([
      ...vehicleLogs.filter((l) => l.date === summaryDate).map((l) => l.driverId),
      ...checks.filter((c) => c.date === summaryDate).map((c) => c.driverId),
    ]);
    return [...ids].map((id) => ({ id, ...alcoholChecksFor(checks, id, summaryDate) }));
  }, [vehicleLogs, checks, summaryDate]);

  function exportCsv() {
    downloadCsv(
      `アルコールチェック記録_${month}.csv`,
      ["確認日", "確認時刻", "区分", "運転者", "自動車", "確認方法", "検知器使用", "測定値(mg/L)", "酒気帯びの有無", "確認者", "指示事項", "その他"],
      filtered.map((c) => [
        c.date,
        c.time,
        c.timing === "before" ? "運転前" : "運転後",
        staffName(c.driverId),
        vehicleName(c.vehicleId),
        c.method,
        c.detectorUsed ? "有" : "無",
        c.value.toFixed(2),
        isAlcoholDetected(c) ? "有" : "無",
        staffName(c.checkerId),
        c.instructions,
        c.notes,
      ])
    );
  }

  return (
    <PageContainer>
      <PageHeader
        icon="🌬️"
        title="アルコールチェック"
        description="社用車の運転前・運転後に、アルコール検知器で測定した結果を記録します。記録は1年間保存してください。"
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <form onSubmit={submit} className="space-y-4">
            <h2 className="text-sm font-bold text-slate-900">記録を入力</h2>
            <div className="grid grid-cols-2 gap-2">
              {(["before", "after"] as AlcoholCheckTiming[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm({ ...form, timing: t })}
                  className={`rounded-lg py-3 text-sm font-bold ${
                    form.timing === t ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {t === "before" ? "🚗 運転前" : "🏁 運転後"}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="確認日" required hint={autoTime ? "記録した時点の日時が自動で入ります" : "手入力した日時で記録します"}>
                <input
                  type="date"
                  className={inputClass}
                  required
                  value={form.date}
                  onChange={(e) => {
                    setAutoTime(false);
                    setForm({ ...form, date: e.target.value });
                  }}
                />
              </Field>
              <Field label="確認時刻" required>
                <input
                  type="time"
                  className={inputClass}
                  required
                  value={form.time}
                  onChange={(e) => {
                    setAutoTime(false);
                    setForm({ ...form, time: e.target.value });
                  }}
                />
              </Field>
              <Field label="運転者" required>
                <StaffSelect staff={drivers} value={form.driverId} onChange={(v) => setForm({ ...form, driverId: v })} required />
              </Field>
              <Field label="自動車" required>
                <select className={inputClass} required value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}>
                  <option value="">選択してください</option>
                  {activeVehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}({v.plate})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="測定値 (mg/L)" required>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  className={`${inputClass} ${detected ? "border-rose-400 bg-rose-50 text-rose-700" : ""}`}
                  required
                  value={valueText}
                  onChange={(e) => {
                    setValueText(e.target.value);
                    setForm({ ...form, value: Number(e.target.value) || 0 });
                  }}
                />
              </Field>
              <Field label="確認方法" required>
                <select className={inputClass} value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value as AlcoholCheckMethod })}>
                  {METHODS.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </Field>
              <Field label="確認者(安全運転管理者等)" required className="col-span-2">
                <StaffSelect staff={checkers} value={form.checkerId} onChange={(v) => setForm({ ...form, checkerId: v })} required />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand-600"
                checked={form.detectorUsed}
                onChange={(e) => setForm({ ...form, detectorUsed: e.target.checked })}
              />
              アルコール検知器を使用した
            </label>
            {detected && (
              <div className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
                ⚠ アルコールが検知されています。運転させず、安全運転管理者の指示に従ってください。
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="指示事項">
                <input className={inputClass} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
              </Field>
              <Field label="その他・備考">
                <input className={inputClass} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </Field>
            </div>
            <button type="submit" className={`${buttonClass.primary} w-full py-3`}>
              記録する
            </button>
            {saved && (
              <p className={`rounded-lg p-3 text-sm font-semibold ${saved.startsWith("⚠") ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
                {saved}
              </p>
            )}
          </form>
        </Card>

        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900">日別の実施状況</h2>
            <input type="date" className={`${inputClass} max-w-40`} value={summaryDate} onChange={(e) => setSummaryDate(e.target.value)} />
          </div>
          <p className="mt-1 text-[11px] text-slate-400">運行管理表またはチェック記録がある運転者を表示します</p>
          {summary.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">{formatDate(summaryDate)} の記録はありません。</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {summary.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span className="font-medium text-slate-700">{staffName(s.id)}</span>
                  <span className="flex gap-1">
                    {(["before", "after"] as const).map((t) => {
                      const c = s[t];
                      const label = t === "before" ? "前" : "後";
                      if (!c) return <StatusPill key={t} tone="warn">{label}: 未</StatusPill>;
                      return (
                        <StatusPill key={t} tone={isAlcoholDetected(c) ? "danger" : "ok"}>
                          {label}: {isAlcoholDetected(c) ? "検知" : c.time}
                        </StatusPill>
                      );
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-8 mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-bold text-slate-900">記録一覧</h2>
        <div className="flex flex-wrap gap-2">
          <input type="month" className={`${inputClass} w-auto`} value={month} onChange={(e) => setMonth(e.target.value)} />
          <select className={`${inputClass} w-auto`} value={driverFilter} onChange={(e) => setDriverFilter(e.target.value)}>
            <option value="">運転者: すべて</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <button type="button" className={buttonClass.secondary} onClick={exportCsv}>
            CSV出力
          </button>
        </div>
      </div>
      {filtered.length === 0 ? (
        <EmptyState>この月の記録はありません。</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                {["日時", "区分", "運転者", "自動車", "方法", "測定値", "判定", "確認者", "指示事項・備考", ""].map((h) => (
                  <th key={h} className="px-3 py-2 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((c) => (
                <tr key={c.id} className={isAlcoholDetected(c) ? "bg-rose-50/60" : ""}>
                  <td className="whitespace-nowrap px-3 py-2">
                    {formatDate(c.date)} {c.time}
                  </td>
                  <td className="px-3 py-2">{c.timing === "before" ? "運転前" : "運転後"}</td>
                  <td className="px-3 py-2">{staffName(c.driverId)}</td>
                  <td className="px-3 py-2 text-xs">{vehicleName(c.vehicleId)}</td>
                  <td className="px-3 py-2">
                    {c.method}
                    {!c.detectorUsed && <span className="ml-1 text-[11px] text-rose-600">(検知器なし)</span>}
                  </td>
                  <td className="px-3 py-2 font-mono">{c.value.toFixed(2)}</td>
                  <td className="px-3 py-2">
                    {isAlcoholDetected(c) ? <StatusPill tone="danger">酒気帯びあり</StatusPill> : <StatusPill tone="ok">なし</StatusPill>}
                  </td>
                  <td className="px-3 py-2">{staffName(c.checkerId)}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{[c.instructions, c.notes].filter(Boolean).join(" / ")}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      className={buttonClass.danger}
                      onClick={() => confirm("この記録を削除しますか?") && collection("alcoholChecks").remove(c.id)}
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
    </PageContainer>
  );
}
