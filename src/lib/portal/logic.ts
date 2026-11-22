import { AlcoholCheck, Committee, Evaluation, EvaluationCriterion, Minutes, Notice, ParkingLot, ParkingSpace, Staff, VehicleLog } from "./types";
import { addMonths, todayString } from "./util";

export function noticeVisibleTo(notice: Notice, staff: Staff | undefined): boolean {
  if (!staff) return true;
  return notice.units.length === 0 || notice.units.includes(staff.unitId);
}

export function sortNotices(notices: Notice[]): Notice[] {
  return [...notices].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export type CommitteeStatus = {
  committee: Committee;
  lastDate: string | null;
  nextDue: string | null;
  state: "ok" | "soon" | "overdue" | "never" | "none";
  count: number;
};

/** 委員会ごとの開催状況(最終開催日と次回開催期限)を計算する */
export function committeeStatuses(committees: Committee[], minutes: Minutes[], today = todayString()): CommitteeStatus[] {
  const soonLimit = addMonths(today, 1);
  return committees.map((committee) => {
    const held = minutes.filter((m) => m.committeeId === committee.id).map((m) => m.date).sort();
    const lastDate = held.length ? held[held.length - 1] : null;
    if (!committee.frequencyMonths) {
      return { committee, lastDate, nextDue: null, state: "none", count: held.length };
    }
    if (!lastDate) return { committee, lastDate, nextDue: null, state: "never", count: 0 };
    const nextDue = addMonths(lastDate, committee.frequencyMonths);
    const state = nextDue < today ? "overdue" : nextDue <= soonLimit ? "soon" : "ok";
    return { committee, lastDate, nextDue, state, count: held.length };
  });
}

export function alcoholChecksFor(checks: AlcoholCheck[], driverId: string, date: string) {
  const list = checks.filter((c) => c.driverId === driverId && c.date === date);
  return {
    before: list.find((c) => c.timing === "before"),
    after: list.find((c) => c.timing === "after"),
  };
}

/** 呼気中アルコール濃度が0より大きければ「酒気帯びあり」として扱う(社内ルール上の判定) */
export function isAlcoholDetected(check: AlcoholCheck): boolean {
  return check.value > 0;
}

export function average(nums: (number | null)[]): number | null {
  const valid = nums.filter((n): n is number => typeof n === "number");
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

export function evaluationAverages(ev: Evaluation, criteria: EvaluationCriterion[]) {
  const scores = criteria.map((c) => ev.scores[c.id]);
  return {
    self: average(scores.map((s) => s?.self ?? null)),
    evaluator: average(scores.map((s) => s?.evaluator ?? null)),
  };
}

/** 評価者平均(1〜5)から総合ランクを算出する */
export function rankFromAverage(avg: number | null): string {
  if (avg === null) return "-";
  if (avg >= 4.5) return "S";
  if (avg >= 3.8) return "A";
  if (avg >= 3.0) return "B";
  if (avg >= 2.2) return "C";
  return "D";
}

export const RANK_GUIDE = "S: 4.5以上 / A: 3.8以上 / B: 3.0以上 / C: 2.2以上 / D: 2.2未満(評価者平均)";

/** 現在日付から評価期間の候補(年度・上期/下期)を作る。年度は4月始まり。 */
export function periodOptions(today = todayString()): string[] {
  const [y, m] = today.split("-").map(Number);
  const fy = m >= 4 ? y : y - 1;
  const list: string[] = [];
  for (let year = fy + 1; year >= fy - 2; year--) {
    list.push(`${year}年度 下期`, `${year}年度 上期`);
  }
  return list;
}

export function currentPeriod(today = todayString()): string {
  const [y, m] = today.split("-").map(Number);
  const fy = m >= 4 ? y : y - 1;
  return `${fy}年度 ${m >= 4 && m <= 9 ? "上期" : "下期"}`;
}

export type SpaceStatus = { tone: "ok" | "warn" | "danger" | "neutral" | "info"; label: string; detail: string };

/**
 * 区画の現在の状況。社用車の区画は、当日の運行管理表に「帰着時刻が未入力」の記録があれば外出中とみなす。
 */
export function parkingSpaceStatus(
  space: ParkingSpace,
  vehicleLogs: VehicleLog[],
  vehicleName: (id: string) => string,
  staffName: (id: string) => string,
  today = todayString()
): SpaceStatus {
  if (space.usage === "社用車") {
    if (!space.vehicleId) return { tone: "neutral", label: "未割当", detail: "車両が割り当てられていません" };
    const out = vehicleLogs.find((l) => l.vehicleId === space.vehicleId && l.date === today && l.startTime && !l.endTime);
    return out
      ? { tone: "warn", label: "外出中", detail: `${vehicleName(space.vehicleId)} ・ ${staffName(out.driverId)} が ${out.startTime} に出発` }
      : { tone: "ok", label: "駐車中", detail: vehicleName(space.vehicleId) };
  }
  if (space.usage === "職員通勤") {
    if (!space.staffId) return { tone: "neutral", label: "未割当", detail: "職員が割り当てられていません" };
    return { tone: "info", label: "割当済", detail: `${staffName(space.staffId)}${space.staffCarPlate ? `(${space.staffCarPlate})` : ""}` };
  }
  if (space.occupiedBy) {
    return { tone: "danger", label: "使用中", detail: `${space.occupiedBy}${space.occupiedUntil ? ` 〜${space.occupiedUntil}頃まで` : ""}` };
  }
  return { tone: "ok", label: "空き", detail: space.usage };
}

/** 契約期限が過ぎた・60日以内に迫っている駐車場 */
export function parkingContractAlerts(lots: ParkingLot[], today = todayString()) {
  const limit = addMonths(today, 2);
  return lots
    .filter((l) => l.contractEnd && l.contractEnd <= limit)
    .map((l) => ({ lot: l, overdue: l.contractEnd < today }));
}
