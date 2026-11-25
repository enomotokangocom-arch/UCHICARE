"use client";

import { useMemo, useState } from "react";
import { usePortalStore } from "@/lib/portal/store";
import { pct, yen } from "@/lib/portal/logic";
import { BUSINESS_UNITS, unitName } from "@/lib/portal/defaults";
import { computeUnitProfit, defaultStaffCost } from "@/lib/portal/profit";
import {
  BusinessUnitId,
  FixedCost,
  PersonalSales,
  ProfitSettings,
  StaffCost,
} from "@/lib/portal/types";
import { newId, nowIsoLocal, todayString } from "@/lib/portal/util";
import { Card, Field, buttonClass, inputClass } from "./ui";
import { SaveBar, useDraftList, useUnsavedWarning } from "./useDraft";
import { SalaryImport } from "./SalaryImport";

type CostEdit = Partial<
  Pick<StaffCost, "monthlySalary" | "fte" | "revenueGenerating">
>;
const cell = `${inputClass} py-1 text-right font-mono`;
const numOrNull = (v: string) => (v === "" ? null : Number(v));

/** 個人の毎月の目標売上(利益ライン)。給与と固定費から計算する */
export function ProfitLineTab({
  units,
  canEdit,
}: {
  units: BusinessUnitId[];
  canEdit: boolean;
}) {
  const staff = usePortalStore((s) => s.staff);
  const savedCosts = usePortalStore((s) => s.staffCosts);
  const savedSettings = usePortalStore((s) => s.profitSettings);
  const setProfitSettings = usePortalStore((s) => s.setProfitSettings);
  const replaceCollection = usePortalStore((s) => s.replaceCollection);
  const personalSales = usePortalStore((s) => s.personalSales);
  const applyMonthlySales = usePortalStore((s) => s.applyMonthlySales);

  const [unitId, setUnitId] = useState<BusinessUnitId>(units[0] ?? "houkan");
  const fixed = useDraftList("fixedCosts");
  const [settingsDraft, setSettingsDraft] = useState<ProfitSettings | null>(
    null,
  );
  const settings = settingsDraft ?? savedSettings;
  const [edits, setEdits] = useState<Record<string, CostEdit>>({});
  const dirty =
    fixed.dirty || settingsDraft !== null || Object.keys(edits).length > 0;
  useUnsavedWarning(dirty);

  // 下書きを反映した人件費
  const costs: StaffCost[] = useMemo(() => {
    const list = [...savedCosts];
    for (const [staffId, e] of Object.entries(edits)) {
      const i = list.findIndex((c) => c.staffId === staffId);
      const s = staff.find((x) => x.id === staffId);
      const base: StaffCost =
        i >= 0
          ? list[i]
          : {
              id: staffId,
              staffId,
              monthlySalary: null,
              ...(s
                ? defaultStaffCost(s)
                : { fte: 1, revenueGenerating: true }),
              profitLine: null,
              targetSales: null,
              updatedAt: "",
            };
      const next = { ...base, ...e };
      if (i >= 0) list[i] = next;
      else list.push(next);
    }
    return list;
  }, [savedCosts, edits, staff]);

  const result = computeUnitProfit(unitId, staff, costs, fixed.items, settings);
  const unitFixed = fixed.items.filter((f) => f.unitId === unitId);
  const month = todayString().slice(0, 7);
  const salesOf = (staffId: string) =>
    personalSales
      .filter(
        (p) => p.staffId === staffId && p.month <= month && p.revenue !== null,
      )
      .sort((a, b) => b.month.localeCompare(a.month))[0];
  const setEdit = (staffId: string, patch: CostEdit) =>
    setEdits((e) => ({ ...e, [staffId]: { ...e[staffId], ...patch } }));

  /** 保存: 設定・固定費・人件費を保存し、全事業所の利益ラインを計算し直して記録する */
  function save() {
    const nextSettings = settings;
    if (settingsDraft) setProfitSettings(settingsDraft);
    if (fixed.dirty) fixed.save();
    const fixedItems = fixed.items;
    const stamp = nowIsoLocal();
    const next = [...costs];
    for (const u of BUSINESS_UNITS) {
      const r = computeUnitProfit(u.id, staff, next, fixedItems, nextSettings);
      for (const row of r.rows) {
        const i = next.findIndex((c) => c.staffId === row.staff.id);
        if (i < 0) continue;
        const c = next[i];
        if (
          c.profitLine !== row.profitLine ||
          c.targetSales !== row.targetSales ||
          edits[c.staffId]
        ) {
          next[i] = {
            ...c,
            fte: row.fte,
            revenueGenerating: row.revenueGenerating,
            profitLine: row.profitLine,
            targetSales: row.targetSales,
            updatedAt: stamp,
          };
        }
      }
    }
    replaceCollection("staffCosts", next);
    setEdits({});
    setSettingsDraft(null);
  }

  function reset() {
    fixed.reset();
    setEdits({});
    setSettingsDraft(null);
  }

  /** 目標売上(または利益ライン)を、指定の月の個人の目標にする */
  function applyToTargets(kind: "targetSales" | "profitLine") {
    const m = prompt("どの月の個人の目標に反映しますか?(例: 2026-12)", month);
    if (!m || !/^\d{4}-\d{2}$/.test(m)) return;
    const rows = result.rows.filter((r) => r[kind] !== null);
    if (
      !confirm(
        `${unitName(unitId)}の${rows.length}名の${m.replace("-", "年")}月の目標を「${kind === "targetSales" ? "目標売上" : "利益ライン"}」にします。よろしいですか?`,
      )
    )
      return;
    const next: PersonalSales[] = [...personalSales];
    for (const r of rows) {
      const i = next.findIndex(
        (p) => p.staffId === r.staff.id && p.month === m,
      );
      if (i >= 0) next[i] = { ...next[i], target: r[kind] };
      else
        next.push({
          id: newId("ps"),
          staffId: r.staff.id,
          month: m,
          revenue: null,
          target: r[kind],
          visits: null,
        });
    }
    applyMonthlySales(next);
    alert("個人の目標に反映しました。");
  }

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-sm font-bold text-slate-900">
          個人の毎月の目標売上(利益ライン)とは
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">
          <strong>利益ライン</strong> = 本人の人件費(給与+法定福利費など) +
          事業所の固定費と事務などの人件費の按分(常勤換算の割合)。この売上を下回ると赤字です。
          <br />
          <strong>目標売上</strong> = 利益ライン ÷ (1 −
          目標利益率)。目標の利益を確保するための売上です。
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          {units.length > 1 && (
            <Field label="事業所">
              <select
                className={inputClass}
                value={unitId}
                onChange={(e) => setUnitId(e.target.value as BusinessUnitId)}
              >
                {units.map((u) => (
                  <option key={u} value={u}>
                    {unitName(u)}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field
            label="法定福利費など(給与に対する%)"
            hint="社会保険・労働保険の会社負担など"
          >
            <input
              type="number"
              step="0.1"
              min="0"
              className={`${inputClass} w-28`}
              disabled={!canEdit}
              value={Math.round(settings.welfareRate * 1000) / 10}
              onChange={(e) =>
                setSettingsDraft({
                  ...settings,
                  welfareRate: (Number(e.target.value) || 0) / 100,
                })
              }
            />
          </Field>
          <Field label="目標利益率(売上に対する%)">
            <input
              type="number"
              step="0.5"
              min="0"
              max="90"
              className={`${inputClass} w-28`}
              disabled={!canEdit}
              value={Math.round(settings.marginRate * 1000) / 10}
              onChange={(e) =>
                setSettingsDraft({
                  ...settings,
                  marginRate: (Number(e.target.value) || 0) / 100,
                })
              }
            />
          </Field>
        </div>
      </Card>

      {canEdit && (
        <SalaryImport
          onApply={(e) =>
            setEdits((prev) => {
              const next = { ...prev };
              for (const [id, patch] of Object.entries(e))
                next[id] = { ...next[id], ...patch };
              return next;
            })
          }
        />
      )}

      <div className="space-y-4">
        <Card className="max-w-xl">
          <h2 className="text-sm font-bold text-slate-900">
            🏢 {unitName(unitId)}の固定費(月額)
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-500">
            家賃・駐車場・車両リース・ガソリン・保険・システム利用料・通信費など
          </p>
          <ul className="mt-2 space-y-1.5">
            {unitFixed.map((f) => (
              <li key={f.id} className="flex items-center gap-1.5">
                <input
                  className={`${inputClass} py-1 text-xs`}
                  value={f.name}
                  disabled={!canEdit}
                  onChange={(e) => fixed.update(f.id, { name: e.target.value })}
                  aria-label="費目"
                />
                <input
                  type="number"
                  className={`${cell} w-28 text-xs`}
                  value={f.amount || ""}
                  disabled={!canEdit}
                  onChange={(e) =>
                    fixed.update(f.id, { amount: Number(e.target.value) || 0 })
                  }
                  aria-label={`${f.name} 金額`}
                />
                {canEdit && (
                  <button
                    type="button"
                    className={buttonClass.ghost}
                    onClick={() => fixed.remove(f.id)}
                    aria-label="削除"
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
          {canEdit && (
            <button
              type="button"
              className={`${buttonClass.secondary} mt-2`}
              onClick={() =>
                fixed.add(
                  { id: newId("fc"), unitId, name: "", amount: 0 } as FixedCost,
                  true,
                )
              }
            >
              ＋ 費目を追加
            </button>
          )}
          <dl className="mt-3 space-y-1 border-t border-slate-100 pt-2 text-xs">
            <div className="flex justify-between">
              <dt className="text-slate-500">固定費の合計</dt>
              <dd className="font-mono font-bold">{yen(result.fixedTotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">売上を上げない職員の人件費</dt>
              <dd className="font-mono">{yen(result.overheadLabor)}</dd>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-1">
              <dt className="font-bold text-slate-700">
                事業所の利益ライン(月)
              </dt>
              <dd className="font-mono font-bold text-brand-700">
                {yen(result.unitProfitLine)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">
                目標売上(利益率{pct(settings.marginRate)})
              </dt>
              <dd className="font-mono">{yen(result.unitTargetSales)}</dd>
            </div>
          </dl>
        </Card>

        <Card className="p-0 sm:p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
            <h2 className="text-sm font-bold text-slate-900">
              👤 個人の利益ライン
            </h2>
            {canEdit && (
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  className={buttonClass.secondary}
                  disabled={dirty}
                  onClick={() => applyToTargets("targetSales")}
                >
                  目標売上を個人の目標に反映
                </button>
                <button
                  type="button"
                  className={buttonClass.ghost}
                  disabled={dirty}
                  onClick={() => applyToTargets("profitLine")}
                >
                  利益ラインを目標に反映
                </button>
              </div>
            )}
          </div>
          <div className="overflow-x-auto p-2">
            <table className="w-full min-w-[880px] text-sm">
              <thead className="text-xs text-slate-500">
                <tr className="text-right">
                  <th className="px-1.5 py-1.5 text-left font-semibold">
                    氏名
                  </th>
                  <th className="px-1.5 py-1.5 font-semibold">月の給与</th>
                  <th className="px-1.5 py-1.5 font-semibold">常勤換算</th>
                  <th className="px-1.5 py-1.5 text-center font-semibold">
                    売上を上げる
                  </th>
                  <th className="px-1.5 py-1.5 font-semibold">
                    人件費(福利込)
                  </th>
                  <th className="px-1.5 py-1.5 font-semibold">
                    固定費などの按分
                  </th>
                  <th className="px-1.5 py-1.5 font-semibold">利益ライン</th>
                  <th className="px-1.5 py-1.5 font-semibold">目標売上</th>
                  <th className="px-1.5 py-1.5 font-semibold">直近の売上</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-right">
                {result.rows.map((r) => {
                  const last = salesOf(r.staff.id);
                  const diff =
                    last?.revenue != null && r.profitLine !== null
                      ? last.revenue - r.profitLine
                      : null;
                  return (
                    <tr
                      key={r.staff.id}
                      className={
                        r.revenueGenerating ? "" : "bg-slate-50 text-slate-500"
                      }
                    >
                      <td className="whitespace-nowrap px-1.5 py-1.5 text-left">
                        <span className="font-medium text-slate-800">
                          {r.staff.name}
                        </span>
                        <span className="ml-1 text-[11px] text-slate-400">
                          {r.staff.role}
                        </span>
                      </td>
                      <td className="px-1.5 py-1">
                        <input
                          type="number"
                          className={`${cell} w-28`}
                          disabled={!canEdit}
                          value={r.salary ?? ""}
                          placeholder="未入力"
                          onChange={(e) =>
                            setEdit(r.staff.id, {
                              monthlySalary: numOrNull(e.target.value),
                            })
                          }
                          aria-label={`${r.staff.name} 月の給与`}
                        />
                      </td>
                      <td className="px-1.5 py-1">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="1.5"
                          className={`${cell} w-16`}
                          disabled={!canEdit}
                          value={r.fte}
                          onChange={(e) =>
                            setEdit(r.staff.id, {
                              fte: Number(e.target.value) || 0,
                            })
                          }
                          aria-label={`${r.staff.name} 常勤換算`}
                        />
                      </td>
                      <td className="px-1.5 py-1 text-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-brand-600"
                          disabled={!canEdit}
                          checked={r.revenueGenerating}
                          onChange={(e) =>
                            setEdit(r.staff.id, {
                              revenueGenerating: e.target.checked,
                            })
                          }
                          aria-label={`${r.staff.name} 売上を上げる`}
                        />
                      </td>
                      <td className="px-1.5 py-1.5 font-mono text-xs">
                        {yen(r.labor === null ? null : Math.round(r.labor))}
                      </td>
                      <td className="px-1.5 py-1.5 font-mono text-xs">
                        {r.revenueGenerating ? yen(r.share) : "按分する側"}
                      </td>
                      <td className="px-1.5 py-1.5 font-mono font-bold text-brand-700">
                        {yen(r.profitLine)}
                      </td>
                      <td className="px-1.5 py-1.5 font-mono font-bold">
                        {yen(r.targetSales)}
                      </td>
                      <td className="px-1.5 py-1.5 font-mono text-xs">
                        {last ? (
                          <>
                            {yen(last.revenue)}
                            <span className="ml-1 text-[10px] text-slate-400">
                              {Number(last.month.slice(5))}月
                            </span>
                            {diff !== null && (
                              <span
                                className={`block text-[10px] ${diff >= 0 ? "text-emerald-700" : "text-rose-600"}`}
                              >
                                {diff >= 0 ? "＋" : "−"}
                                {yen(Math.abs(diff))}
                              </span>
                            )}
                          </>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="px-2 pt-2 text-[11px] text-slate-400">
              ※
              給与は手当を含む総支給額(賞与があれば月割りを足す)。給与は経営者・統括部長と、その事業所の管理者・本人だけが見られます(本人には自分の利益ラインだけ表示)。
              給与が未入力の人は計算に入りません。売上を上げない職員(事務など)の人件費は、売上を上げる職員で分け合います。
            </p>
          </div>
        </Card>
      </div>

      {canEdit ? (
        <SaveBar
          dirty={dirty}
          onSave={save}
          onReset={reset}
          label="保存して利益ラインを計算し直す"
        />
      ) : (
        <p className="text-[11px] text-slate-400">
          給与・固定費の入力は経営者・統括部長が行います。
        </p>
      )}
    </div>
  );
}
