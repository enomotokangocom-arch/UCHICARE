"use client";

import { FormEvent, useMemo, useState } from "react";
import clsx from "clsx";
import { VehiclesTab } from "@/components/portal/VehiclesTab";
import { usePortalStore, useCurrentStaff, useStaffName, useVehicleName } from "@/lib/portal/store";
import { parkingContractAlerts, parkingSpaceStatus } from "@/lib/portal/logic";
import { BUSINESS_UNITS } from "@/lib/portal/defaults";
import { BusinessUnitId, ParkingLot, ParkingOwnership, ParkingSpace, ParkingUsage } from "@/lib/portal/types";
import { formatDate, newId, nowTimeString } from "@/lib/portal/util";
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

const OWNERSHIPS: ParkingOwnership[] = ["自社所有", "賃貸(月極)", "その他"];
const USAGES: ParkingUsage[] = ["社用車", "職員通勤", "来客用", "予備"];

const TILE_TONE = {
  ok: "border-emerald-300 bg-emerald-50",
  warn: "border-amber-300 bg-amber-50",
  danger: "border-rose-300 bg-rose-50",
  info: "border-sky-300 bg-sky-50",
  neutral: "border-dashed border-slate-300 bg-slate-50",
} as const;

type LotForm = Omit<ParkingLot, "id">;

function blankLot(unitId: BusinessUnitId): LotForm {
  return { name: "", unitId, address: "", mapUrl: "", ownership: "自社所有", contractor: "", contact: "", monthlyFee: null, contractEnd: "", notes: "" };
}

function mapHref(lot: ParkingLot): string {
  if (lot.mapUrl) return lot.mapUrl;
  return lot.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lot.address)}` : "";
}

function LotFormCard({ initial, onSave, onCancel }: { initial: LotForm; onSave: (f: LotForm) => void; onCancel: () => void }) {
  const [f, setF] = useState<LotForm>(initial);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSave(f);
  };
  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border border-brand-300 bg-brand-50/30 p-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="駐車場名" required className="sm:col-span-2">
          <input className={inputClass} required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="管理する事業所">
          <select className={inputClass} value={f.unitId} onChange={(e) => setF({ ...f, unitId: e.target.value as BusinessUnitId })}>
            {BUSINESS_UNITS.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="形態">
          <select className={inputClass} value={f.ownership} onChange={(e) => setF({ ...f, ownership: e.target.value as ParkingOwnership })}>
            {OWNERSHIPS.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </Field>
        <Field label="所在地" className="sm:col-span-2">
          <input className={inputClass} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
        </Field>
        <Field label="地図のURL" hint="空欄なら所在地からGoogleマップを開きます" className="sm:col-span-2">
          <input type="url" className={inputClass} value={f.mapUrl} onChange={(e) => setF({ ...f, mapUrl: e.target.value.trim() })} />
        </Field>
        {f.ownership !== "自社所有" && (
          <>
            <Field label="貸主・管理会社">
              <input className={inputClass} value={f.contractor} onChange={(e) => setF({ ...f, contractor: e.target.value })} />
            </Field>
            <Field label="連絡先">
              <input className={inputClass} value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} />
            </Field>
            <Field label="月額(円・駐車場全体)">
              <input
                type="number"
                inputMode="numeric"
                className={inputClass}
                value={f.monthlyFee ?? ""}
                onChange={(e) => setF({ ...f, monthlyFee: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </Field>
            <Field label="契約期限・更新日">
              <input type="date" className={inputClass} value={f.contractEnd} onChange={(e) => setF({ ...f, contractEnd: e.target.value })} />
            </Field>
          </>
        )}
        <Field label="備考(鍵・ルールなど)" className="sm:col-span-2 lg:col-span-4">
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

function SpaceEditor({ space, onClose }: { space: ParkingSpace; onClose: () => void }) {
  const staff = usePortalStore((s) => s.staff);
  const vehicles = usePortalStore((s) => s.vehicles);
  const collection = usePortalStore((s) => s.collection);
  const current = useCurrentStaff();
  const up = (patch: Partial<ParkingSpace>) => collection("parkingSpaces").update(space.id, patch);
  const [visitor, setVisitor] = useState({ name: "", until: "" });
  const temporary = space.usage === "来客用" || space.usage === "予備";

  return (
    <div className="mt-3 space-y-4 rounded-lg border border-brand-300 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">区画「{space.label}」</h3>
        <button type="button" className={buttonClass.ghost} onClick={onClose}>
          閉じる
        </button>
      </div>

      {temporary && (
        <div className="rounded-lg bg-slate-50 p-3">
          {space.occupiedBy ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-slate-700">
                使用中: <span className="font-bold">{space.occupiedBy}</span>
                {space.occupiedUntil && ` (〜${space.occupiedUntil}頃まで)`}
              </p>
              <button type="button" className={buttonClass.primary} onClick={() => up({ occupiedBy: "", occupiedUntil: "" })}>
                空きにする
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-2">
              <Field label="使用する人・車" className="min-w-40 flex-1">
                <input
                  className={inputClass}
                  placeholder={current ? `例: ${current.name} / ○○様(来客)` : "例: ○○様(来客)"}
                  value={visitor.name}
                  onChange={(e) => setVisitor({ ...visitor, name: e.target.value })}
                />
              </Field>
              <Field label="終了予定">
                <input type="time" className={inputClass} value={visitor.until} onChange={(e) => setVisitor({ ...visitor, until: e.target.value })} />
              </Field>
              <button
                type="button"
                className={buttonClass.primary}
                onClick={() => up({ occupiedBy: visitor.name.trim() || current?.name || "使用中", occupiedUntil: visitor.until })}
              >
                使用中にする
              </button>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Field label="区画番号・名称">
          <input className={inputClass} value={space.label} onChange={(e) => up({ label: e.target.value })} />
        </Field>
        <Field label="用途">
          <select className={inputClass} value={space.usage} onChange={(e) => up({ usage: e.target.value as ParkingUsage })}>
            {USAGES.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </Field>
        {space.usage === "社用車" && (
          <Field label="割り当てる車両" className="col-span-2">
            <select className={inputClass} value={space.vehicleId} onChange={(e) => up({ vehicleId: e.target.value })}>
              <option value="">(未割当)</option>
              {vehicles
                .filter((v) => v.active)
                .map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}({v.plate})
                  </option>
                ))}
            </select>
          </Field>
        )}
        {space.usage === "職員通勤" && (
          <>
            <Field label="割り当てる職員">
              <StaffSelect staff={staff.filter((s) => s.active)} value={space.staffId} onChange={(v) => up({ staffId: v })} placeholder="(未割当)" />
            </Field>
            <Field label="自家用車ナンバー">
              <input className={inputClass} value={space.staffCarPlate} onChange={(e) => up({ staffCarPlate: e.target.value })} />
            </Field>
          </>
        )}
        <Field label="備考" className="col-span-2 md:col-span-4">
          <input className={inputClass} value={space.notes} onChange={(e) => up({ notes: e.target.value })} />
        </Field>
      </div>
      <div className="flex justify-between">
        <p className="text-[11px] text-slate-400">入力内容は自動で保存されます</p>
        <button
          type="button"
          className={buttonClass.danger}
          onClick={() => {
            if (confirm(`区画「${space.label}」を削除しますか?`)) {
              collection("parkingSpaces").remove(space.id);
              onClose();
            }
          }}
        >
          区画を削除
        </button>
      </div>
    </div>
  );
}

function ParkingTab() {
  const lots = usePortalStore((s) => s.parkingLots);
  const spaces = usePortalStore((s) => s.parkingSpaces);
  const vehicles = usePortalStore((s) => s.vehicles);
  const vehicleLogs = usePortalStore((s) => s.vehicleLogs);
  const collection = usePortalStore((s) => s.collection);
  const current = useCurrentStaff();
  const staffName = useStaffName();
  const vehicleName = useVehicleName();

  const [unit, setUnit] = useState<BusinessUnitId | "all">("all");
  const [lotEditing, setLotEditing] = useState<string | "new" | null>(null);
  const [selectedSpace, setSelectedSpace] = useState<string | null>(null);

  const visibleLots = lots.filter((l) => unit === "all" || l.unitId === unit);
  const status = (s: ParkingSpace) => parkingSpaceStatus(s, vehicleLogs, vehicleName, staffName);

  const stats = useMemo(() => {
    const lotIds = new Set(visibleLots.map((l) => l.id));
    const target = spaces.filter((s) => lotIds.has(s.lotId));
    const sts = target.map((s) => parkingSpaceStatus(s, vehicleLogs, vehicleName, staffName));
    return {
      spaces: target.length,
      free: sts.filter((s) => s.label === "空き").length,
      out: sts.filter((s) => s.label === "外出中").length,
      fee: visibleLots.reduce((sum, l) => sum + (l.monthlyFee ?? 0), 0),
    };
  }, [visibleLots, spaces, vehicleLogs, vehicleName, staffName]);

  const contractAlerts = parkingContractAlerts(visibleLots);
  const unassignedVehicles = vehicles.filter(
    (v) => v.active && !spaces.some((s) => s.usage === "社用車" && s.vehicleId === v.id)
  );

  function addSpace(lotId: string) {
    const count = spaces.filter((s) => s.lotId === lotId).length;
    const id = newId("ps");
    collection("parkingSpaces").add({
      id,
      lotId,
      label: String(count + 1),
      usage: "社用車",
      vehicleId: "",
      staffId: "",
      staffCarPlate: "",
      occupiedBy: "",
      occupiedUntil: "",
      notes: "",
    });
    setSelectedSpace(id);
  }

  return (
    <>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">
          社用車の「駐車中/外出中」は運行管理表(帰着時刻が未入力の記録)から判定します。{nowTimeString()} 時点
        </p>
        <button type="button" className={buttonClass.primary} onClick={() => setLotEditing("new")}>
          ＋ 駐車場を追加
        </button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["駐車場", `${visibleLots.length} か所`],
          ["区画", `${stats.spaces} 区画`],
          ["空き / 外出中", `${stats.free} / ${stats.out}`],
          ["賃料 月額合計", `¥${stats.fee.toLocaleString()}`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="text-[11px] font-semibold text-slate-500">{label}</p>
            <p className="mt-0.5 text-lg font-bold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      {(contractAlerts.length > 0 || unassignedVehicles.length > 0) && (
        <Card className="mb-4 border-amber-200 bg-amber-50/40">
          <ul className="space-y-1.5 text-sm">
            {contractAlerts.map(({ lot, overdue }) => (
              <li key={lot.id} className="flex flex-wrap items-center gap-2">
                <StatusPill tone={overdue ? "danger" : "warn"}>{overdue ? "契約期限切れ" : "契約更新が近い"}</StatusPill>
                {lot.name}(期限 {formatDate(lot.contractEnd)}
                {lot.contractor && ` ・ ${lot.contractor}`})
              </li>
            ))}
            {unassignedVehicles.length > 0 && (
              <li className="flex flex-wrap items-center gap-2">
                <StatusPill tone="warn">駐車区画なし</StatusPill>
                {unassignedVehicles.map((v) => v.name).join("、")}
              </li>
            )}
          </ul>
        </Card>
      )}

      {lotEditing === "new" && (
        <div className="mb-4">
          <LotFormCard
            initial={blankLot(current?.unitId ?? "houkan")}
            onCancel={() => setLotEditing(null)}
            onSave={(f) => {
              collection("parkingLots").add({ ...f, id: newId("p") });
              setLotEditing(null);
            }}
          />
        </div>
      )}

      <div className="mb-4">
        <UnitFilter value={unit} onChange={setUnit} />
      </div>

      {visibleLots.length === 0 ? (
        <EmptyState>登録されている駐車場はありません。</EmptyState>
      ) : (
        <div className="space-y-5">
          {visibleLots.map((lot) => {
            const lotSpaces = spaces.filter((s) => s.lotId === lot.id);
            const selected = lotSpaces.find((s) => s.id === selectedSpace);
            const href = mapHref(lot);
            if (lotEditing === lot.id) {
              return (
                <LotFormCard
                  key={lot.id}
                  // eslint-disable-next-line @typescript-eslint/no-unused-vars
                  initial={(({ id, ...rest }) => rest)(lot)}
                  onCancel={() => setLotEditing(null)}
                  onSave={(f) => {
                    collection("parkingLots").update(lot.id, f);
                    setLotEditing(null);
                  }}
                />
              );
            }
            return (
              <Card key={lot.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-bold text-slate-900">{lot.name}</h2>
                      <UnitBadge unitId={lot.unitId} />
                      <StatusPill tone="neutral">{lot.ownership}</StatusPill>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {lot.address || "所在地未登録"}
                      {href && (
                        <a href={href} target="_blank" rel="noopener noreferrer" className="ml-2 font-semibold text-brand-700 hover:underline">
                          📍 地図 ↗
                        </a>
                      )}
                    </p>
                    {lot.ownership !== "自社所有" && (
                      <p className="mt-0.5 text-xs text-slate-500">
                        {[
                          lot.contractor,
                          lot.contact,
                          lot.monthlyFee !== null ? `月額 ¥${lot.monthlyFee.toLocaleString()}` : "",
                          lot.contractEnd ? `契約期限 ${formatDate(lot.contractEnd)}` : "",
                        ]
                          .filter(Boolean)
                          .join(" ・ ")}
                      </p>
                    )}
                    {lot.notes && <p className="mt-0.5 text-xs text-slate-400">📝 {lot.notes}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button type="button" className={buttonClass.ghost} onClick={() => addSpace(lot.id)}>
                      ＋ 区画
                    </button>
                    <button type="button" className={buttonClass.ghost} onClick={() => setLotEditing(lot.id)}>
                      編集
                    </button>
                    <button
                      type="button"
                      className={buttonClass.danger}
                      onClick={() => {
                        if (confirm(`「${lot.name}」と、その区画をすべて削除しますか?`)) {
                          lotSpaces.forEach((s) => collection("parkingSpaces").remove(s.id));
                          collection("parkingLots").remove(lot.id);
                        }
                      }}
                    >
                      削除
                    </button>
                  </div>
                </div>

                {lotSpaces.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-400">区画がありません。「＋ 区画」から追加してください。</p>
                ) : (
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                    {[...lotSpaces]
                      .sort((a, b) => a.label.localeCompare(b.label, "ja", { numeric: true }))
                      .map((s) => {
                        const st = status(s);
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setSelectedSpace(selectedSpace === s.id ? null : s.id)}
                            className={clsx(
                              "rounded-lg border-2 p-2.5 text-left transition hover:shadow",
                              TILE_TONE[st.tone],
                              selectedSpace === s.id && "ring-2 ring-brand-500 ring-offset-1"
                            )}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-lg font-black text-slate-800">{s.label}</span>
                              <StatusPill tone={st.tone}>{st.label}</StatusPill>
                            </div>
                            <p className="text-[11px] font-semibold text-slate-500">{s.usage}</p>
                            <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-600">{st.detail}</p>
                          </button>
                        );
                      })}
                  </div>
                )}
                {selected && <SpaceEditor key={selected.id} space={selected} onClose={() => setSelectedSpace(null)} />}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

type Tab = "vehicles" | "parking";

export default function VehiclesAndParkingPage() {
  const [tab, setTab] = useState<Tab>("vehicles");
  return (
    <PageContainer>
      <PageHeader icon="🚙" title="車両・駐車場管理" description="社用車の情報(車検・保険・リース)と、駐車場・区画の割り当てをまとめて管理します。" />
      <div className="mb-5 flex gap-1 border-b border-slate-200">
        {(
          [
            ["vehicles", "🚗 車両"],
            ["parking", "🅿️ 駐車場"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={clsx("-mb-px border-b-2 px-4 py-2 text-sm font-semibold", tab === id ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800")}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "vehicles" ? <VehiclesTab /> : <ParkingTab />}
    </PageContainer>
  );
}
