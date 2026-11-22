import { AlcoholCheck, Committee, Evaluation, EvaluationCriterion, Minutes, Notice, ParkingLot, ParkingSpace, Staff, VehicleLog } from "./types";
import { addMonths, todayString } from "./util";
import { BusinessUnitId, Goal, NanbyoEntry, NanbyoPatient } from "./types";

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

/** 全社の管理権限(お知らせの編集・人事評価の管理など) */
export function isAdmin(staff: Staff | undefined): boolean {
  if (!staff) return false;
  return staff.role === "管理者" || ["経営者", "統括部長", "事務長"].includes(staff.position);
}

/**
 * 経営数値を見られる範囲。
 * 経営者・統括部長・事務長 = 全事業所 / 所長 = 自分の事業所 / それ以外 = 自分の個人売上のみ
 */
export function financeScope(staff: Staff | undefined): { all: boolean; units: BusinessUnitId[] } {
  if (!staff) return { all: false, units: [] };
  if (isAdmin(staff)) return { all: true, units: [] };
  if (staff.position === "所長") return { all: false, units: [staff.unitId] };
  return { all: false, units: [] };
}

export function sum(nums: (number | null | undefined)[]): number {
  return nums.reduce<number>((a, b) => a + (b ?? 0), 0);
}

export function yen(n: number | null | undefined): string {
  if (n === null || n === undefined) return "-";
  return `¥${Math.round(n).toLocaleString()}`;
}

/** 万円表記(グラフ・タイル用) */
export function manYen(n: number): string {
  return `${(n / 10000).toLocaleString(undefined, { maximumFractionDigits: 1 })}万円`;
}

export function pct(n: number | null): string {
  return n === null || !Number.isFinite(n) ? "-" : `${(n * 100).toFixed(1)}%`;
}

/** 医療費の自己負担額は10円未満四捨五入 */
export function roundTo10(n: number): number {
  return Math.round(n / 10) * 10;
}

export function nanbyoMonthSummary(patient: NanbyoPatient, entries: NanbyoEntry[], month: string) {
  const list = entries
    .filter((e) => e.patientId === patient.id && e.date.startsWith(month))
    .sort((a, b) => `${a.date}${a.createdAt}`.localeCompare(`${b.date}${b.createdAt}`));
  let cumulative = 0;
  const rows = list.map((e) => {
    cumulative += e.copay;
    return { entry: e, cumulative };
  });
  const remaining = Math.max(0, patient.monthlyCap - cumulative);
  return { rows, cumulative, remaining, reached: cumulative >= patient.monthlyCap };
}

/** 今回徴収する自己負担額の目安 = min(医療費総額 × 負担割合, 上限額までの残り) */
export function suggestedCopay(totalCost: number, burdenRate: number, remaining: number): number {
  return Math.min(roundTo10(totalCost * burdenRate), remaining);
}

/** 目標の達成度(0〜1)。数値目標があれば実績÷目標、なければ状態から判断する */
export function goalProgress(g: Goal): number {
  if (g.status === "達成") return 1;
  if (g.targetValue && g.currentValue !== null) return Math.max(0, Math.min(1, g.currentValue / g.targetValue));
  return g.status === "進行中" ? 0.5 : 0;
}

/** 目標の期間の選択肢: 前月〜3か月先の各月と、今年度・来年度の半期 */
export function goalPeriodOptions(today = todayString()): { value: string; label: string }[] {
  const [y, m] = today.split("-").map(Number);
  const months = [-1, 0, 1, 2, 3].map((d) => {
    const dt = new Date(y, m - 1 + d, 1);
    const v = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    return { value: v, label: `${dt.getFullYear()}年${dt.getMonth() + 1}月` };
  });
  const fy = m >= 4 ? y : y - 1;
  const halves = [`${fy}年度 上期`, `${fy}年度 下期`, `${fy + 1}年度 上期`].map((v) => ({ value: v, label: v }));
  return [...months, ...halves];
}

export function goalPeriodLabel(period: string): string {
  const m = period.match(/^(\d{4})-(\d{2})$/);
  return m ? `${m[1]}年${Number(m[2])}月` : period;
}

/** 今の時点で有効な目標か(今月の目標、または今の半期の目標) */
export function isCurrentGoal(g: Goal, today = todayString()): boolean {
  return g.period === today.slice(0, 7) || g.period === currentPeriod(today);
}

/** 事業所の月の売上・目標 */
export function unitMonth(finance: import("./types").FinanceMonthly[], unitId: BusinessUnitId, month: string) {
  const f = finance.find((x) => x.unitId === unitId && x.month === month);
  return { revenue: f?.revenue ?? null, target: f?.revenueTarget ?? null };
}

/** 事業所の年度(4月始まり)累計: 売上が入っている月の売上と、その月の目標 */
export function unitFiscalToDate(finance: import("./types").FinanceMonthly[], unitId: BusinessUnitId, today = todayString()) {
  const [y, m] = today.split("-").map(Number);
  const fy = m >= 4 ? y : y - 1;
  const from = `${fy}-04`;
  const to = `${fy + 1}-03`;
  const rows = finance.filter((x) => x.unitId === unitId && x.month >= from && x.month <= to);
  const filled = rows.filter((x) => x.revenue !== null);
  const latest = [...filled].sort((a, b) => b.month.localeCompare(a.month))[0];
  return {
    fy,
    revenue: sum(filled.map((x) => x.revenue)),
    target: sum(filled.map((x) => x.revenueTarget)),
    yearTarget: sum(rows.map((x) => x.revenueTarget)),
    latestMonth: latest?.month ?? null,
    latestRevenue: latest?.revenue ?? null,
    latestTarget: latest?.revenueTarget ?? null,
  };
}

/** 健康経営ツールを閲覧できる「責任者以上」: 経営者・統括部長・事務長・所長・リハ責任者 */
export function canViewHealthTool(staff: Staff | undefined): boolean {
  if (!staff) return false;
  return isAdmin(staff) || staff.position === "所長" || staff.position === "リハ責任者";
}

/** 健康経営ツールの画面のパス */
export const HEALTH_TOOL_PATHS = ["/health", "/dashboard", "/chat", "/articles", "/survey"];

export function isHealthToolPath(pathname: string): boolean {
  return HEALTH_TOOL_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
