"use client";

import { useState } from "react";
import clsx from "clsx";
import { usePortalStore, useCurrentStaff } from "@/lib/portal/store";
import { goalPeriodLabel, goalPeriodOptions, isAdmin, pct, unitFiscalToDate, unitMonth, yen } from "@/lib/portal/logic";
import { canEditPersonal, canEditUnit, canSeePersonalAmounts, canSeeUnitAmounts } from "@/lib/portal/permissions";
import { BUSINESS_UNITS, unitName } from "@/lib/portal/defaults";
import { BusinessUnitId } from "@/lib/portal/types";
import { todayString } from "@/lib/portal/util";
import { GoalList } from "@/components/portal/GoalList";
import { GoalSheetOverview, GoalSheetPanel } from "@/components/portal/GoalSheetPanel";
import { Card, PageContainer, PageHeader, ProgressBar, UnitBadge, inputClass } from "@/components/portal/ui";

type Tab = "personal" | "unit";

function SalesSummary({ label, revenue, target, visits, showAmounts }: { label: string; revenue: number | null; target: number | null; visits?: number | null; showAmounts: boolean }) {
  const ratio = revenue !== null && target ? revenue / target : null;
  return (
    <Card className="mb-4">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      {revenue === null && target === null ? (
        <p className="mt-2 text-sm text-slate-400">売上・目標はまだ入力されていません(「経営数値」で管理者・統括部長が入力します)。</p>
      ) : (
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {showAmounts && (
            <>
              <div>
                <p className="text-[11px] text-slate-500">売上</p>
                <p className="text-lg font-bold text-slate-900">{yen(revenue)}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">売上目標</p>
                <p className="text-lg font-bold text-slate-900">{yen(target)}</p>
              </div>
            </>
          )}
          <div className={showAmounts ? "" : "col-span-2"}>
            <p className="text-[11px] text-slate-500">達成率</p>
            <ProgressBar ratio={ratio} className="mt-2" />
          </div>
          {visits !== undefined && (
            <div>
              <p className="text-[11px] text-slate-500">訪問件数</p>
              <p className="text-lg font-bold text-slate-900">{visits ?? "-"}</p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default function GoalsPage() {
  const staff = usePortalStore((s) => s.staff);
  const goals = usePortalStore((s) => s.goals);
  const personalSales = usePortalStore((s) => s.personalSales);
  const finance = usePortalStore((s) => s.finance);
  const current = useCurrentStaff();
  const admin = isAdmin(current);

  const [tab, setTab] = useState<Tab>("personal");
  const [period, setPeriod] = useState(todayString().slice(0, 7));
  const [staffId, setStaffId] = useState(current?.id ?? "");
  const [unitId, setUnitId] = useState<BusinessUnitId>(current?.unitId ?? "houkan");

  // 個人目標を見られる職員: 経営者・統括部長=全員 / 管理者=自事業所 / その他=自分
  const viewableStaff = staff.filter(
    (s) => s.active && (admin || s.id === current?.id || (current?.position === "管理者" && s.unitId === current.unitId))
  );
  const target = viewableStaff.find((s) => s.id === staffId) ?? current;
  const viewableUnits = admin ? BUSINESS_UNITS.map((u) => u.id) : current ? [current.unitId] : [];
  const unit = viewableUnits.includes(unitId) ? unitId : viewableUnits[0];
  const isMonth = /^\d{4}-\d{2}$/.test(period);

  const personalGoals = goals.filter((g) => g.scope === "personal" && g.staffId === target?.id && g.period === period);
  const unitGoals = goals.filter((g) => g.scope === "unit" && g.unitId === unit && g.period === period);
  const sales = isMonth ? personalSales.find((p) => p.staffId === target?.id && p.month === period) : undefined;
  const unitSales = isMonth && unit ? unitMonth(finance, unit, period) : null;
  const fyToDate = unit ? unitFiscalToDate(finance, unit) : null;

  return (
    <PageContainer>
      <PageHeader
        icon="🎯"
        title="目標管理"
        description="目標管理シート(Googleスプレッドシートが原本)の進捗と、月ごとの行動目標・部門の目標を管理します。今月・今の半期の目標はポータルホームに表示されます。"
        actions={
          <select className={`${inputClass} w-auto`} value={period} onChange={(e) => setPeriod(e.target.value)}>
            {goalPeriodOptions().map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        }
      />

      <div className="mb-5 flex gap-1 border-b border-slate-200">
        {(
          [
            ["personal", "個人の目標"],
            ["unit", "部門の目標"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={clsx("-mb-px border-b-2 px-3 py-2 text-sm font-semibold", tab === id ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800")}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "personal" && target && (
        <>
          {viewableStaff.length > 1 && (
            <select className={`${inputClass} mb-4 w-auto`} value={target.id} onChange={(e) => setStaffId(e.target.value)}>
              {viewableStaff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}({unitName(s.unitId)}・{s.position})
                </option>
              ))}
            </select>
          )}
          <GoalSheetPanel target={target} canEdit={canEditPersonal(current, target)} />
          {isMonth && (
            <SalesSummary
              label={`${target.name} さんの ${goalPeriodLabel(period)} の売上(経営数値より)`}
              revenue={sales?.revenue ?? null}
              target={sales?.target ?? null}
              visits={sales?.visits ?? null}
              showAmounts={canSeePersonalAmounts(current, target)}
            />
          )}
          <h2 className="mb-2 mt-2 text-sm font-bold text-slate-900">🗒️ {goalPeriodLabel(period)} の行動目標</h2>
          <GoalList
            goals={personalGoals}
            canEdit={canEditPersonal(current, target)}
            base={{ scope: "personal", staffId: target.id, unitId: target.unitId, period }}
            emptyText={`${goalPeriodLabel(period)} の個人目標はまだありません。`}
          />
          {viewableStaff.length > 1 && <GoalSheetOverview staff={viewableStaff} />}
        </>
      )}

      {tab === "unit" && unit && (
        <>
          {viewableUnits.length > 1 && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {viewableUnits.map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUnitId(u)}
                  className={clsx("rounded-full px-3 py-1.5 text-xs font-semibold", unit === u ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200")}
                >
                  {unitName(u)}
                </button>
              ))}
            </div>
          )}
          {unitSales && canSeeUnitAmounts(current, unit) && (
            <SalesSummary
              label={`${unitName(unit)} の ${goalPeriodLabel(period)} の売上(経営数値より)`}
              revenue={unitSales.revenue}
              target={unitSales.target}
              showAmounts={canSeeUnitAmounts(current, unit)}
            />
          )}
          {fyToDate && fyToDate.target > 0 && canSeeUnitAmounts(current, unit) && (
            <p className="-mt-2 mb-4 flex items-center gap-2 text-xs text-slate-500">
              <UnitBadge unitId={unit} /> {fyToDate.fy}年度の累計達成率 {pct(fyToDate.revenue / fyToDate.target)}
              {canSeeUnitAmounts(current, unit) && `(${yen(fyToDate.revenue)} / ${yen(fyToDate.target)})`}
            </p>
          )}
          <GoalList
            goals={unitGoals}
            canEdit={canEditUnit(current, unit)}
            base={{ scope: "unit", staffId: "", unitId: unit, period }}
            emptyText={`${unitName(unit)} の ${goalPeriodLabel(period)} の部門目標はまだありません。`}
          />
          {!canEditUnit(current, unit) && <p className="mt-2 text-[11px] text-slate-400">部門の目標は管理者・統括部長・経営者が入力します。</p>}
        </>
      )}
    </PageContainer>
  );
}
