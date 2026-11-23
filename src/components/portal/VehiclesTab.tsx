"use client";

import { useState } from "react";
import clsx from "clsx";
import { usePortalStore, useStaffName } from "@/lib/portal/store";
import { VEHICLE_DATE_FIELDS, vehicleAlerts } from "@/lib/portal/logic";
import { BUSINESS_UNITS } from "@/lib/portal/defaults";
import { BusinessUnitId, Vehicle, VehicleOwnership } from "@/lib/portal/types";
import { formatDate, newId, todayString } from "@/lib/portal/util";
import { Card, EmptyState, Field, StatusPill, UnitBadge, UnitFilter, buttonClass, inputClass } from "./ui";
import { SaveBar, useUnsavedWarning } from "./useDraft";

const OWNERSHIPS: VehicleOwnership[] = ["自社所有", "リース", "その他"];

type SpaceOption = { id: string; label: string };

function VehicleEditor({
  v,
  spaceId,
  spaceOptions,
  onAssign,
}: {
  v: Vehicle;
  spaceId: string;
  spaceOptions: SpaceOption[];
  onAssign: (spaceId: string) => boolean;
}) {
  const collection = usePortalStore((s) => s.collection);
  const logs = usePortalStore((s) => s.vehicleLogs);
  // 変更は下書きに入れ、「保存する」で反映する
  const [d, setD] = useState<Vehicle>(v);
  const [space, setSpace] = useState(spaceId);
  const dirty = JSON.stringify(d) !== JSON.stringify(v) || space !== spaceId;
  useUnsavedWarning(dirty);
  const up = (patch: Partial<Vehicle>) => setD((x) => ({ ...x, ...patch }));
  const text = (key: keyof Vehicle, label: string, opts: { type?: string; placeholder?: string; className?: string } = {}) => (
    <Field label={label} className={opts.className}>
      <input
        type={opts.type ?? "text"}
        className={inputClass}
        placeholder={opts.placeholder}
        value={(d[key] as string | undefined) ?? ""}
        onChange={(e) => up({ [key]: e.target.value })}
      />
    </Field>
  );
  return (
    <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {text("name", "車両名", { placeholder: "訪看1号車" })}
        <Field label="🅿️ 駐車区画" className="col-span-2 md:col-span-4">
          <select className={inputClass} value={space} onChange={(e) => setSpace(e.target.value)}>
            <option value="">(未割当)</option>
            {spaceOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        {text("plate", "ナンバー", { placeholder: "横浜 580 あ 12-34" })}
        {text("model", "車種・色", { placeholder: "N-BOX(白)" })}
        <Field label="管理する事業所">
          <select className={inputClass} value={d.unitId} onChange={(e) => up({ unitId: e.target.value as BusinessUnitId })}>
            {BUSINESS_UNITS.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="所有形態">
          <select className={inputClass} value={d.ownership ?? "自社所有"} onChange={(e) => up({ ownership: e.target.value as VehicleOwnership })}>
            {OWNERSHIPS.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </Field>
        {text("leaseCompany", "リース会社・購入先")}
        {text("leaseEnd", "リース契約の期限", { type: "date" })}
        {text("inspectionDue", "車検満了日", { type: "date" })}
        {text("compulsoryInsuranceEnd", "自賠責保険の期限", { type: "date" })}
        {text("voluntaryInsuranceEnd", "任意保険の期限", { type: "date" })}
        {text("insuranceCompany", "保険会社・連絡先", { className: "col-span-2" })}
        {text("notes", "備考(点検・修理の記録など)", { className: "col-span-2 md:col-span-4" })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={d.active} onChange={(e) => up({ active: e.target.checked })} />
          使用中(外すと運行管理表・アルコールチェックの選択肢に出なくなります)
        </label>
        <button
          type="button"
          className={buttonClass.danger}
          onClick={() => {
            if (logs.some((l) => l.vehicleId === v.id)) {
              alert("運行記録がある車両は削除できません。使わなくなった場合は「使用中」を外してください。");
              return;
            }
            if (confirm(`「${v.name}」を削除しますか?`)) collection("vehicles").remove(v.id);
          }}
        >
          車両を削除
        </button>
      </div>
      <SaveBar
        dirty={dirty}
        sticky={false}
        onSave={() => {
          if (space !== spaceId && !onAssign(space)) return;
          collection("vehicles").update(v.id, d);
        }}
        onReset={() => {
          setD(v);
          setSpace(spaceId);
        }}
      />
    </div>
  );
}

export function VehiclesTab() {
  const vehicles = usePortalStore((s) => s.vehicles);
  const logs = usePortalStore((s) => s.vehicleLogs);
  const spaces = usePortalStore((s) => s.parkingSpaces);
  const lots = usePortalStore((s) => s.parkingLots);
  const collection = usePortalStore((s) => s.collection);
  const staffName = useStaffName();
  const [unit, setUnit] = useState<BusinessUnitId | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const today = todayString();
  const month = today.slice(0, 7);
  const list = vehicles.filter((v) => (showInactive || v.active) && (unit === "all" || v.unitId === unit));
  const alerts = vehicleAlerts(vehicles);
  const carSpaces = spaces.filter((s) => s.usage === "社用車");
  const spaceLabel = (spaceId: string) => {
    const sp = spaces.find((s) => s.id === spaceId);
    const lot = lots.find((l) => l.id === sp?.lotId);
    return sp ? `${lot?.name ?? ""} ${sp.label}番` : "";
  };

  function assignSpace(vehicleId: string, spaceId: string): boolean {
    const target = spaces.find((s) => s.id === spaceId);
    if (target?.vehicleId && target.vehicleId !== vehicleId) {
      const other = vehicles.find((v) => v.id === target.vehicleId);
      if (!confirm(`${spaceLabel(spaceId)} には「${other?.name ?? "別の車両"}」が割り当てられています。入れ替えますか?`)) return false;
    }
    for (const s of spaces.filter((x) => x.vehicleId === vehicleId && x.id !== spaceId)) collection("parkingSpaces").update(s.id, { vehicleId: "" });
    if (target) collection("parkingSpaces").update(target.id, { vehicleId });
    return true;
  }

  function addVehicle() {
    const id = newId("v");
    collection("vehicles").add({ id, name: "新しい車両", plate: "", unitId: unit === "all" ? "houkan" : unit, active: true, ownership: "自社所有" });
    setOpenId(id);
  }

  return (
    <div>
      {alerts.length > 0 && (
        <Card className="mb-4 border-amber-200 bg-amber-50/40">
          <h2 className="mb-1.5 text-sm font-bold text-slate-900">期限のお知らせ</h2>
          <ul className="space-y-1 text-sm">
            {alerts.map((a) => (
              <li key={`${a.vehicle.id}-${a.label}`} className="flex flex-wrap items-center gap-2">
                <StatusPill tone={a.overdue ? "danger" : "warn"}>{a.overdue ? `${a.label} 期限切れ` : `${a.label} 期限が近い`}</StatusPill>
                {a.vehicle.name}({formatDate(a.date)})
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <UnitFilter value={unit} onChange={setUnit} />
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            使用中でない車両も表示
          </label>
          <button type="button" className={buttonClass.primary} onClick={addVehicle}>
            ＋ 車両を追加
          </button>
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState>登録されている車両はありません。</EmptyState>
      ) : (
        <div className="space-y-3">
          {list.map((v) => {
            const out = logs.find((l) => l.vehicleId === v.id && l.date === today && l.startTime && !l.endTime);
            const space = carSpaces.find((s) => s.vehicleId === v.id);
            const km = logs
              .filter((l) => l.vehicleId === v.id && l.date.startsWith(month) && l.startOdometer !== null && l.endOdometer !== null)
              .reduce((sum, l) => sum + ((l.endOdometer ?? 0) - (l.startOdometer ?? 0)), 0);
            const myAlerts = alerts.filter((a) => a.vehicle.id === v.id);
            const open = openId === v.id;
            return (
              <Card key={v.id} className={clsx(!v.active && "opacity-60", open && "border-brand-300")}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-bold text-brand-700">🚗 {v.name}</span>
                      <UnitBadge unitId={v.unitId} />
                      {!v.active && <StatusPill tone="neutral">使用停止</StatusPill>}
                      {v.active &&
                        (out ? (
                          <StatusPill tone="warn">
                            外出中({staffName(out.driverId)}・{out.startTime}〜)
                          </StatusPill>
                        ) : (
                          <StatusPill tone="ok">駐車中</StatusPill>
                        ))}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {[v.plate || "ナンバー未登録", v.model, v.ownership].filter(Boolean).join(" ・ ")}
                    </p>
                    <p className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-600">
                      <span>今月の走行 {km.toLocaleString()} km</span>
                      {VEHICLE_DATE_FIELDS.map(([key, label]) =>
                        v[key] ? (
                          <span key={key}>
                            {label} {formatDate(v[key] as string)}
                          </span>
                        ) : null
                      )}
                    </p>
                    {myAlerts.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {myAlerts.map((a) => (
                          <StatusPill key={a.label} tone={a.overdue ? "danger" : "warn"}>
                            {a.label}{a.overdue ? " 期限切れ" : " 期限間近"}
                          </StatusPill>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="whitespace-nowrap text-xs text-slate-600">🅿️ {space ? spaceLabel(space.id) : "駐車区画 未割当"}</span>
                    <button type="button" className={buttonClass.ghost} onClick={() => setOpenId(open ? null : v.id)}>
                      {open ? "閉じる" : "詳細・編集"}
                    </button>
                  </div>
                </div>
                {open && (
                  <VehicleEditor
                    key={v.id}
                    v={v}
                    spaceId={space?.id ?? ""}
                    spaceOptions={carSpaces.map((s) => ({
                      id: s.id,
                      label: `${spaceLabel(s.id)}${s.vehicleId && s.vehicleId !== v.id ? `(${vehicles.find((x) => x.id === s.vehicleId)?.name ?? "使用中"})` : ""}`,
                    }))}
                    onAssign={(sid) => assignSpace(v.id, sid)}
                  />
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
