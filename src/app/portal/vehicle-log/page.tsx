"use client";

import { FormEvent, useMemo, useState } from "react";
import { usePortalStore, useCurrentStaff, useStaffName, useVehicleName } from "@/lib/portal/store";
import { alcoholChecksFor, isAlcoholDetected } from "@/lib/portal/logic";
import { VehicleLog } from "@/lib/portal/types";
import { downloadCsv, formatDate, newId, nowIsoLocal, todayString } from "@/lib/portal/util";
import { Card, EmptyState, Field, PageContainer, PageHeader, StaffSelect, StatusPill, buttonClass, inputClass } from "@/components/portal/ui";

type Form = Omit<VehicleLog, "id" | "createdAt">;

const PURPOSES = ["訪問看護", "訪問リハビリ", "居宅訪問(モニタリング等)", "サービス担当者会議", "営業・連携先訪問", "研修・会議", "買い出し・その他"];

function distance(l: Pick<VehicleLog, "startOdometer" | "endOdometer">): number | null {
  if (l.startOdometer === null || l.endOdometer === null) return null;
  return l.endOdometer - l.startOdometer;
}

const numOrNull = (v: string) => (v === "" ? null : Number(v));

export default function VehicleLogPage() {
  const logs = usePortalStore((s) => s.vehicleLogs);
  const staff = usePortalStore((s) => s.staff);
  const vehicles = usePortalStore((s) => s.vehicles);
  const checks = usePortalStore((s) => s.alcoholChecks);
  const collection = usePortalStore((s) => s.collection);
  const current = useCurrentStaff();
  const staffName = useStaffName();
  const vehicleName = useVehicleName();

  const drivers = staff.filter((s) => s.active && s.isDriver);
  const activeVehicles = vehicles.filter((v) => v.active);

  const lastOdometer = (vehicleId: string) =>
    logs
      .filter((l) => l.vehicleId === vehicleId && l.endOdometer !== null)
      .sort((a, b) => `${b.date}${b.endTime}`.localeCompare(`${a.date}${a.endTime}`))[0]?.endOdometer ?? null;

  const initialVehicle = activeVehicles.find((v) => v.unitId === current?.unitId)?.id ?? activeVehicles[0]?.id ?? "";
  const blank = (vehicleId: string): Form => ({
    date: todayString(),
    vehicleId,
    driverId: current?.isDriver ? current.id : "",
    startTime: "",
    endTime: "",
    startOdometer: lastOdometer(vehicleId),
    endOdometer: null,
    destinations: "",
    purpose: PURPOSES[0],
    refuelLiters: null,
    notes: "",
  });

  const [form, setForm] = useState<Form>(() => blank(initialVehicle));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [month, setMonth] = useState(todayString().slice(0, 7));
  const [vehicleFilter, setVehicleFilter] = useState("");

  const formDistance = distance(form);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (formDistance !== null && formDistance < 0) {
      alert("帰着時メーターが出発時メーターより小さくなっています。");
      return;
    }
    if (editingId) {
      collection("vehicleLogs").update(editingId, form);
    } else {
      collection("vehicleLogs").add({ ...form, id: newId("vl"), createdAt: nowIsoLocal() });
    }
    setEditingId(null);
    setForm(blank(form.vehicleId));
  }

  const filtered = useMemo(
    () =>
      logs
        .filter((l) => l.date.startsWith(month) && (!vehicleFilter || l.vehicleId === vehicleFilter))
        .sort((a, b) => `${b.date}${b.startTime}`.localeCompare(`${a.date}${a.startTime}`)),
    [logs, month, vehicleFilter]
  );

  const totals = useMemo(() => {
    const map = new Map<string, { km: number; count: number; fuel: number }>();
    for (const l of logs.filter((x) => x.date.startsWith(month))) {
      const t = map.get(l.vehicleId) ?? { km: 0, count: 0, fuel: 0 };
      t.km += distance(l) ?? 0;
      t.count += 1;
      t.fuel += l.refuelLiters ?? 0;
      map.set(l.vehicleId, t);
    }
    return [...map.entries()];
  }, [logs, month]);

  function exportCsv() {
    downloadCsv(
      `運行管理表_${month}.csv`,
      ["日付", "自動車", "運転者", "出発", "帰着", "出発時メーター(km)", "帰着時メーター(km)", "走行距離(km)", "行先", "用務", "給油(L)", "運転前チェック", "運転後チェック", "備考"],
      filtered.map((l) => {
        const ac = alcoholChecksFor(checks, l.driverId, l.date);
        return [
          l.date,
          vehicleName(l.vehicleId),
          staffName(l.driverId),
          l.startTime,
          l.endTime,
          l.startOdometer,
          l.endOdometer,
          distance(l),
          l.destinations,
          l.purpose,
          l.refuelLiters,
          ac.before ? ac.before.time : "未",
          ac.after ? ac.after.time : "未",
          l.notes,
        ];
      })
    );
  }

  return (
    <PageContainer>
      <PageHeader icon="🚗" title="運行管理表" description="社用車の運行(運転日報)を記録します。メーターから走行距離を自動計算します。" />

      <Card className={editingId ? "border-brand-300" : ""}>
        <form onSubmit={submit} className="space-y-4">
          <h2 className="text-sm font-bold text-slate-900">{editingId ? "運行記録を編集" : "運行記録を入力"}</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Field label="日付" required>
              <input type="date" className={inputClass} required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
            <Field label="自動車" required>
              <select
                className={inputClass}
                required
                value={form.vehicleId}
                onChange={(e) =>
                  setForm({ ...form, vehicleId: e.target.value, startOdometer: editingId ? form.startOdometer : lastOdometer(e.target.value) })
                }
              >
                <option value="">選択してください</option>
                {activeVehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="運転者" required>
              <StaffSelect staff={drivers} value={form.driverId} onChange={(v) => setForm({ ...form, driverId: v })} required />
            </Field>
            <Field label="用務" required>
              <select className={inputClass} value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })}>
                {[...new Set([...PURPOSES, form.purpose])].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </Field>
            <Field label="出発時刻" required>
              <input type="time" className={inputClass} required value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
            </Field>
            <Field label="帰着時刻" hint="出発時に記録し、帰着後に入力すると駐車場管理に反映されます">
              <input type="time" className={inputClass} value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
            </Field>
            <Field label="出発時メーター(km)" hint="前回の帰着時メーターを自動入力">
              <input
                type="number"
                inputMode="numeric"
                className={inputClass}
                value={form.startOdometer ?? ""}
                onChange={(e) => setForm({ ...form, startOdometer: numOrNull(e.target.value) })}
              />
            </Field>
            <Field label="帰着時メーター(km)" hint={formDistance !== null ? `走行距離 ${formDistance} km` : undefined}>
              <input
                type="number"
                inputMode="numeric"
                className={`${inputClass} ${formDistance !== null && formDistance < 0 ? "border-rose-400" : ""}`}
                value={form.endOdometer ?? ""}
                onChange={(e) => setForm({ ...form, endOdometer: numOrNull(e.target.value) })}
              />
            </Field>
            <Field label="行先" className="col-span-2">
              <input
                className={inputClass}
                placeholder="例: 利用者宅4件(○○町・△△町)"
                value={form.destinations}
                onChange={(e) => setForm({ ...form, destinations: e.target.value })}
              />
            </Field>
            <Field label="給油(L)">
              <input
                type="number"
                step="0.1"
                inputMode="decimal"
                className={inputClass}
                value={form.refuelLiters ?? ""}
                onChange={(e) => setForm({ ...form, refuelLiters: numOrNull(e.target.value) })}
              />
            </Field>
            <Field label="備考(車両の異常など)">
              <input className={inputClass} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
          </div>
          <div className="flex gap-2">
            <button type="submit" className={buttonClass.primary}>
              {editingId ? "保存する" : "記録する"}
            </button>
            {editingId && (
              <button
                type="button"
                className={buttonClass.secondary}
                onClick={() => {
                  setEditingId(null);
                  setForm(blank(form.vehicleId));
                }}
              >
                キャンセル
              </button>
            )}
          </div>
        </form>
      </Card>

      <div className="mt-8 mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-bold text-slate-900">運行記録一覧</h2>
        <div className="flex flex-wrap gap-2">
          <input type="month" className={`${inputClass} w-auto`} value={month} onChange={(e) => setMonth(e.target.value)} />
          <select className={`${inputClass} w-auto`} value={vehicleFilter} onChange={(e) => setVehicleFilter(e.target.value)}>
            <option value="">車両: すべて</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          <button type="button" className={buttonClass.secondary} onClick={exportCsv}>
            CSV出力
          </button>
        </div>
      </div>

      {totals.length > 0 && (
        <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {totals.map(([vid, t]) => (
            <div key={vid} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
              <p className="font-semibold text-slate-800">{vehicleName(vid)}</p>
              <p className="mt-0.5">
                今月 {t.count}回 ・ 走行 <span className="font-bold text-brand-700">{t.km.toLocaleString()} km</span>
                {t.fuel > 0 && ` ・ 給油 ${t.fuel.toFixed(1)} L`}
              </p>
            </div>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState>この月の運行記録はありません。</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                {["日付", "自動車", "運転者", "時間", "メーター", "距離", "行先・用務", "アルコールチェック", ""].map((h) => (
                  <th key={h} className="px-3 py-2 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((l) => {
                const ac = alcoholChecksFor(checks, l.driverId, l.date);
                const d = distance(l);
                return (
                  <tr key={l.id}>
                    <td className="whitespace-nowrap px-3 py-2">{formatDate(l.date)}</td>
                    <td className="px-3 py-2 text-xs">{vehicleName(l.vehicleId)}</td>
                    <td className="px-3 py-2">{staffName(l.driverId)}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {l.startTime}〜{l.endTime}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
                      {l.startOdometer ?? "-"} → {l.endOdometer ?? "-"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-semibold">{d !== null ? `${d} km` : "-"}</td>
                    <td className="px-3 py-2 text-xs">
                      <p>{l.destinations}</p>
                      <p className="text-slate-400">
                        {l.purpose}
                        {l.refuelLiters ? ` ・ 給油${l.refuelLiters}L` : ""}
                        {l.notes ? ` ・ ${l.notes}` : ""}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      <span className="flex gap-1">
                        {(["before", "after"] as const).map((t) => {
                          const c = ac[t];
                          const label = t === "before" ? "前" : "後";
                          return c ? (
                            <StatusPill key={t} tone={isAlcoholDetected(c) ? "danger" : "ok"}>
                              {label}✓
                            </StatusPill>
                          ) : (
                            <StatusPill key={t} tone="warn">
                              {label}未
                            </StatusPill>
                          );
                        })}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <button
                        type="button"
                        className={buttonClass.ghost}
                        onClick={() => {
                          // eslint-disable-next-line @typescript-eslint/no-unused-vars
                          const { id, createdAt, ...rest } = l;
                          setEditingId(id);
                          setForm(rest);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                      >
                        編集
                      </button>
                      <button
                        type="button"
                        className={buttonClass.danger}
                        onClick={() => confirm("この運行記録を削除しますか?") && collection("vehicleLogs").remove(l.id)}
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </PageContainer>
  );
}
