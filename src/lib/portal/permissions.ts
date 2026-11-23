import { financeScope, isAdmin } from "./logic";
import { BusinessUnitId, Staff } from "./types";

/** 個人の目標・実績を編集できるか(本人・経営者/統括部長・同じ事業所の管理者) */
export function canEditPersonal(current: Staff | undefined, target: Staff | undefined): boolean {
  if (!current || !target) return false;
  return current.id === target.id || isAdmin(current) || (current.position === "管理者" && current.unitId === target.unitId);
}

/** 個人の売上金額を見られるか(本人・経営数値の閲覧範囲に入る人) */
export function canSeePersonalAmounts(current: Staff | undefined, target: Staff | undefined): boolean {
  if (!current || !target) return false;
  if (current.id === target.id) return true;
  const scope = financeScope(current);
  return scope.all || scope.units.includes(target.unitId);
}

/** 部門の目標を編集できるか(経営者/統括部長・その事業所の管理者) */
export function canEditUnit(current: Staff | undefined, unitId: BusinessUnitId): boolean {
  if (!current) return false;
  return isAdmin(current) || (current.position === "管理者" && current.unitId === unitId);
}

/** 部門の売上(金額・達成率)を見られるか。一般職(経営数値の閲覧範囲外)は自分以外の売上を見られない */
export function canSeeUnitAmounts(current: Staff | undefined, unitId: BusinessUnitId): boolean {
  const scope = financeScope(current);
  return scope.all || scope.units.includes(unitId);
}
