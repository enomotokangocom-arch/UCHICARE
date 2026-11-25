/**
 * 個人の毎月の目標売上(利益ライン)の計算
 *
 *  人件費        = 月の給与 × (1 + 法定福利費などの率)
 *  分け合う費用  = 事業所の固定費 + 売上を上げない職員(事務など)の人件費
 *  按分          = 分け合う費用 × その人の常勤換算 ÷ 売上を上げる職員の常勤換算の合計
 *  利益ライン    = 人件費 + 按分                (この売上で赤字にならない = 損益分岐)
 *  目標売上      = 利益ライン ÷ (1 − 目標利益率)  (目標の利益率を確保できる売上)
 */
import { BusinessUnitId, FixedCost, ProfitSettings, Staff, StaffCost } from "./types";

export interface ProfitRow {
  staff: Staff;
  cost: StaffCost | undefined;
  salary: number | null;
  fte: number;
  revenueGenerating: boolean;
  /** 人件費(法定福利費など込み) */
  labor: number | null;
  /** 固定費などの按分 */
  share: number | null;
  profitLine: number | null;
  targetSales: number | null;
}

export interface UnitProfit {
  unitId: BusinessUnitId;
  fixedTotal: number;
  /** 売上を上げない職員の人件費の合計 */
  overheadLabor: number;
  /** 事業所全体の利益ライン(人件費 + 固定費) */
  unitProfitLine: number;
  unitTargetSales: number;
  rows: ProfitRow[];
}

export function defaultStaffCost(s: Staff): Pick<StaffCost, "fte" | "revenueGenerating"> {
  return { fte: 1, revenueGenerating: !["事務", "店舗スタッフ"].includes(s.role) };
}

export function computeUnitProfit(
  unitId: BusinessUnitId,
  staff: Staff[],
  costs: StaffCost[],
  fixedCosts: FixedCost[],
  settings: ProfitSettings
): UnitProfit {
  const people = staff.filter((s) => s.active && s.unitId === unitId);
  const base = people.map((s) => {
    const cost = costs.find((c) => c.staffId === s.id);
    const def = defaultStaffCost(s);
    const salary = cost?.monthlySalary ?? null;
    const fte = cost?.fte ?? def.fte;
    const revenueGenerating = cost?.revenueGenerating ?? def.revenueGenerating;
    const labor = salary === null ? null : salary * (1 + settings.welfareRate);
    return { staff: s, cost, salary, fte, revenueGenerating, labor };
  });
  const fixedTotal = fixedCosts.filter((f) => f.unitId === unitId).reduce((a, f) => a + (f.amount || 0), 0);
  const overheadLabor = base.filter((b) => !b.revenueGenerating).reduce((a, b) => a + (b.labor ?? 0), 0);
  const earners = base.filter((b) => b.revenueGenerating && b.labor !== null);
  const fteTotal = earners.reduce((a, b) => a + (b.fte || 0), 0);
  const shared = fixedTotal + overheadLabor;
  const keep = 1 - Math.min(Math.max(settings.marginRate, 0), 0.9);

  const rows: ProfitRow[] = base.map((b) => {
    if (!b.revenueGenerating || b.labor === null || !fteTotal) {
      return { ...b, share: null, profitLine: null, targetSales: null };
    }
    const share = (shared * (b.fte || 0)) / fteTotal;
    const profitLine = Math.round(b.labor + share);
    return { ...b, share: Math.round(share), profitLine, targetSales: Math.round(profitLine / keep) };
  });
  const unitProfitLine = Math.round(base.reduce((a, b) => a + (b.labor ?? 0), 0) + fixedTotal);
  return { unitId, fixedTotal, overheadLabor, unitProfitLine, unitTargetSales: Math.round(unitProfitLine / keep), rows };
}
