// 権限別の表示用データ。職員（STAFF）には集計値のみを渡す。
// - 部門別の人件費「金額」は、少人数部門で個人給与が推測できるため渡さない（人件費率のみ）
// - 費用の科目明細は、人件費系科目（役員報酬など個人が特定できるもの）を「人件費」1行にまとめる
// - 照合差異の明細は渡さない（合計額のみ）
import type { ExpenseLine, MonthPL, UnitPL } from "./pl";
import type { BusinessUnit, Role } from "./types";

export type ViewUnitPL = Omit<UnitPL, "laborCost"> & { laborCost: number | null };
export type ViewMonthPL = Omit<MonthPL, "company" | "units" | "reconciliation"> & {
  company: ViewUnitPL;
  units: Record<BusinessUnit, ViewUnitPL>;
  reconciliation: Omit<MonthPL["reconciliation"], "segmentDiffs" | "revenue"> & {
    segmentDiffs: MonthPL["reconciliation"]["segmentDiffs"];
    revenue: MonthPL["reconciliation"]["revenue"];
  };
};

export const LABOR_GROUP_NAME = "人件費（合計）";

function groupLabor(lines: ExpenseLine[]): ExpenseLine[] {
  const labor = lines.filter((l) => l.behavior === "LABOR");
  const others = lines.filter((l) => l.behavior !== "LABOR");
  if (labor.length === 0) return others;
  const total = labor.reduce((s, l) => s + l.amount, 0);
  return [{ accountName: LABOR_GROUP_NAME, allocation: "DIRECT", behavior: "LABOR", amount: total }, ...others];
}

export function canSeeDetails(role: Role): boolean {
  return role === "ADMIN" || role === "MANAGER";
}

export function viewPLForRole(pl: MonthPL, role: Role): ViewMonthPL {
  if (canSeeDetails(role)) return pl;
  const maskUnit = (u: UnitPL): ViewUnitPL => ({ ...u, laborCost: null, expenses: [] });
  return {
    ...pl,
    company: { ...pl.company, expenses: groupLabor(pl.company.expenses) },
    units: { HOMONKANGO: maskUnit(pl.units.HOMONKANGO), KYOTAKU: maskUnit(pl.units.KYOTAKU) },
    reconciliation: { ...pl.reconciliation, segmentDiffs: [], revenue: [], unknownAccounts: [] },
  };
}
