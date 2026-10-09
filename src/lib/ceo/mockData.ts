import { CEO_CONFIG } from "./config";
import {
  BRANCHES,
  BranchMonthlyMetric,
  CARE_MANAGEMENT_OFFICES,
  CareManagementMonthlyMetric,
  CeoDataset,
  DAY_SERVICE_OFFICES,
  DayServiceMonthlyMetric,
  HOME_HELP_OFFICES,
  NurseProductivityRecord,
} from "./types";

/**
 * 決定的疑似乱数生成器(mulberry32)。SSR/CSRで同じ値を出すため Math.random は使わない。
 * (src/lib/mockData.ts の既存パターンを踏襲)
 */
function mulberry32(seed: number) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** レポート上の「本日」。固定値でHydration Mismatchを避ける。 */
export const CEO_TODAY = new Date(2026, 8, 4); // 2026-09-04
const MONTH_COUNT = 12;
const REVENUE_PER_VISIT_HOUR = 7500;
const TARGET_UTILIZATION = 0.8;

/** 母集団としての営業先(紹介元)数。100〜200件の想定(訪問看護の拠点別集計にのみ反映)。 */
export const MOCK_REFERRAL_SOURCE_POOL_SIZE = 148;

interface LocationBaseline {
  targetPatients: number;
  nurseCount: number;
  hoursPerNurse: number;
  baseNewPatients: number;
  baseDischarged: number;
  baseHospitalized: number;
  baseResumed: number;
  baseSalesActivities: number;
  baseReferrals: number;
  baseContracts: number;
  laborCostRatio: number;
  variableCostRatio: number;
  fixedCostRatio: number;
  avgRevenuePerPatient: number;
  /** 訪問1時間あたり単価。訪問看護より訪問介護(Uchi Wel)の方が低い想定。 */
  revenuePerVisitHour: number;
}

/** 訪問看護(3拠点)+訪問介護(Uchi Wel、1拠点)。どちらも訪問時間ベースの収益モデルを共有する。 */
const LOCATION_BASELINE: Record<string, LocationBaseline> = {
  仙台北: {
    targetPatients: 105,
    nurseCount: 11,
    hoursPerNurse: 150,
    baseNewPatients: 4,
    baseDischarged: 3,
    baseHospitalized: 1,
    baseResumed: 1,
    baseSalesActivities: 14,
    baseReferrals: 6,
    baseContracts: 4,
    laborCostRatio: 0.54,
    variableCostRatio: 0.09,
    fixedCostRatio: 0.14,
    avgRevenuePerPatient: 91000,
    revenuePerVisitHour: REVENUE_PER_VISIT_HOUR,
  },
  仙台東: {
    targetPatients: 100,
    nurseCount: 10,
    hoursPerNurse: 150,
    baseNewPatients: 3,
    baseDischarged: 3,
    baseHospitalized: 1,
    baseResumed: 1,
    baseSalesActivities: 9,
    baseReferrals: 3,
    baseContracts: 2,
    laborCostRatio: 0.55,
    variableCostRatio: 0.1,
    fixedCostRatio: 0.15,
    avgRevenuePerPatient: 90000,
    revenuePerVisitHour: REVENUE_PER_VISIT_HOUR,
  },
  鶴ヶ谷: {
    targetPatients: 95,
    nurseCount: 9,
    hoursPerNurse: 150,
    baseNewPatients: 6,
    baseDischarged: 2,
    baseHospitalized: 1,
    baseResumed: 1,
    baseSalesActivities: 15,
    baseReferrals: 7,
    baseContracts: 5,
    laborCostRatio: 0.53,
    variableCostRatio: 0.09,
    fixedCostRatio: 0.14,
    avgRevenuePerPatient: 89000,
    revenuePerVisitHour: REVENUE_PER_VISIT_HOUR,
  },
  "Uchi Wel 仙台": {
    targetPatients: 65,
    nurseCount: 8,
    hoursPerNurse: 135,
    baseNewPatients: 3,
    baseDischarged: 2,
    baseHospitalized: 0,
    baseResumed: 1,
    baseSalesActivities: 10,
    baseReferrals: 5,
    baseContracts: 3,
    laborCostRatio: 0.58,
    variableCostRatio: 0.08,
    fixedCostRatio: 0.13,
    avgRevenuePerPatient: 46000,
    revenuePerVisitHour: 3460,
  },
};

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

export function getCeoMonthSequence(reference: Date = CEO_TODAY): { date: Date; key: string }[] {
  const months: { date: Date; key: string }[] = [];
  for (let i = MONTH_COUNT - 1; i >= 0; i -= 1) {
    const d = new Date(reference.getFullYear(), reference.getMonth() - i, 1);
    months.push({ date: d, key: monthKey(d) });
  }
  return months;
}

/** 仙台東は直近3ヶ月で終了利用者急増・稼働率低下により売上未達(Red)になる異常シナリオ。 */
function sendaiHigashiAnomaly(monthsAgo: number) {
  if (monthsAgo === 0) return { utilizationDelta: -0.14, dischargedExtra: 9, salesRatio: 0.55 };
  if (monthsAgo === 1) return { utilizationDelta: -0.09, dischargedExtra: 5, salesRatio: 0.7 };
  if (monthsAgo === 2) return { utilizationDelta: -0.04, dischargedExtra: 2, salesRatio: 0.85 };
  return { utilizationDelta: 0, dischargedExtra: 0, salesRatio: 1 };
}

/** 鶴ヶ谷は利用者増加ペースに人員が追いつかず、稼働率が上がりすぎて90日後に供給不足になるシナリオ。 */
function tsurugayaAnomaly(monthsAgo: number) {
  if (monthsAgo <= 2) return { utilizationDelta: 0.1, newPatientsExtra: 3 };
  if (monthsAgo <= 5) return { utilizationDelta: 0.05, newPatientsExtra: 2 };
  return { utilizationDelta: 0, newPatientsExtra: 0 };
}

/** Uchi Welは直近2ヶ月で軽度の稼働率低下(ヘルパーの新規採用の立ち上がり待ち)。 */
function uchiWelAnomaly(monthsAgo: number) {
  if (monthsAgo <= 1) return { utilizationDelta: -0.07 };
  return { utilizationDelta: 0 };
}

function generateBranchSeries(
  branch: string,
  businessLine: "visiting_nurse" | "home_help",
  rng: () => number
): BranchMonthlyMetric[] {
  const baseline = LOCATION_BASELINE[branch];
  const months = getCeoMonthSequence();
  const records: BranchMonthlyMetric[] = [];
  let patients = baseline.targetPatients - 6;
  let nurseCount = baseline.nurseCount - 1;

  months.forEach((month, index) => {
    const monthsAgo = MONTH_COUNT - 1 - index;
    const isCurrent = monthsAgo === 0;
    const din = daysInMonth(month.date);
    const elapsed = isCurrent ? Math.min(CEO_TODAY.getDate(), din) : din;

    if (index > 0 && index % 3 === 0 && nurseCount < baseline.nurseCount) nurseCount += 1;

    let newPatients = Math.round(baseline.baseNewPatients + (rng() - 0.5) * 2);
    let dischargedPatients = Math.round(baseline.baseDischarged + (rng() - 0.5) * 2);
    const hospitalizedPatients = Math.max(0, Math.round(baseline.baseHospitalized + (rng() - 0.5) * 1.5));
    const resumedPatients = Math.max(0, Math.round(baseline.baseResumed * rng() * 1.5));

    let utilization = TARGET_UTILIZATION + (rng() - 0.5) * 0.04;
    let salesRatio = 1;

    if (branch === "仙台東") {
      const anomaly = sendaiHigashiAnomaly(monthsAgo);
      utilization += anomaly.utilizationDelta;
      dischargedPatients += anomaly.dischargedExtra;
      salesRatio = anomaly.salesRatio;
    }
    if (branch === "鶴ヶ谷") {
      const anomaly = tsurugayaAnomaly(monthsAgo);
      utilization += anomaly.utilizationDelta;
      newPatients += anomaly.newPatientsExtra;
    }
    if (branch === "Uchi Wel 仙台") {
      utilization += uchiWelAnomaly(monthsAgo).utilizationDelta;
    }

    newPatients = Math.max(0, newPatients);
    dischargedPatients = Math.max(0, dischargedPatients);
    utilization = Math.min(0.97, Math.max(0.4, utilization));

    const availableHoursFull = nurseCount * baseline.hoursPerNurse;
    const availableHours = isCurrent ? Math.round((availableHoursFull * elapsed) / din) : availableHoursFull;
    const visitHours = Math.round(availableHours * utilization);

    const avgRevenuePerPatient = Math.round(baseline.avgRevenuePerPatient * (0.98 + rng() * 0.04));

    const revenueActualMtd = Math.round(visitHours * baseline.revenuePerVisitHour * (0.98 + rng() * 0.06));
    const revenueBudget = Math.round(baseline.targetPatients * avgRevenuePerPatient);

    const laborCost = Math.round(revenueBudget * baseline.laborCostRatio * (0.97 + rng() * 0.06));
    const variableCost = Math.round(revenueBudget * baseline.variableCostRatio * (0.95 + rng() * 0.1));
    const fixedCost = Math.round(revenueBudget * baseline.fixedCostRatio);
    const profitBudget = Math.round(
      revenueBudget - revenueBudget * (baseline.laborCostRatio + baseline.variableCostRatio + baseline.fixedCostRatio)
    );

    const salesActivities = Math.max(1, Math.round(baseline.baseSalesActivities * salesRatio + (rng() - 0.5) * 3));
    const referrals = Math.max(0, Math.round(baseline.baseReferrals * salesRatio + (rng() - 0.5) * 1.5));
    const contracts = Math.max(0, Math.min(referrals, Math.round(baseline.baseContracts * salesRatio + (rng() - 0.5) * 1)));

    records.push({
      businessLine,
      branch,
      month: month.key,
      daysElapsed: elapsed,
      daysInMonth: din,
      revenueActualMtd,
      revenueBudget,
      profitBudget,
      laborCost,
      variableCost,
      fixedCost,
      visitHours,
      availableHours,
      nurseCount,
      currentPatients: patients,
      newPatients,
      dischargedPatients,
      hospitalizedPatients,
      resumedPatients,
      avgRevenuePerPatient,
      salesActivities,
      referrals,
      contracts,
    });

    patients = Math.max(20, patients + newPatients + resumedPatients - dischargedPatients - hospitalizedPatients);
  });

  return records;
}

function generateNurseRecords(
  branch: string,
  rng: () => number,
  month: string,
  count: number,
  roleLabel: string,
  revenuePerVisitHour: number
): NurseProductivityRecord[] {
  const records: NurseProductivityRecord[] = [];
  for (let i = 1; i <= count; i += 1) {
    const workHours = Math.round(140 + (rng() - 0.5) * 20);
    // 一部の職員は移動効率が悪い(訪問件数は平均的でも生産性が低い)ケースを混ぜる
    const isLowEfficiency = rng() < 0.15;
    const clinicalUtilization = isLowEfficiency ? 0.42 + rng() * 0.08 : 0.6 + rng() * 0.22;
    const travelEfficiency = isLowEfficiency ? 0.55 + rng() * 0.1 : 0.78 + rng() * 0.15;

    const visitProvidedHours = Math.round(workHours * clinicalUtilization);
    const travelHours = Math.round((visitProvidedHours / travelEfficiency) * (1 - travelEfficiency));
    const visitCount = Math.max(1, Math.round(visitProvidedHours / (1.1 + rng() * 0.3)));
    const workDays = Math.round(18 + (rng() - 0.5) * 4);
    const revenue = Math.round(visitProvidedHours * revenuePerVisitHour * (0.95 + rng() * 0.1));

    records.push({
      nurse: `${branch}-${roleLabel}${String(i).padStart(2, "0")}`,
      branch,
      month,
      visitProvidedHours,
      workHours,
      revenue,
      visitCount,
      workDays,
      travelHours,
    });
  }
  return records;
}

/** 居宅介護支援(ケアマネ事業)の12ヶ月分モックデータ。直近でケアマネ1人あたり担当件数が
 * 目安を上回り続けるケースロード過多シナリオを含む。 */
function generateCareManagementSeries(office: string, rng: () => number): CareManagementMonthlyMetric[] {
  const months = getCeoMonthSequence();
  const records: CareManagementMonthlyMetric[] = [];
  const careManagerCount = 3;
  const targetCaseloadPerFte = CEO_CONFIG.careManagement.targetCaseloadPerFte;
  const avgFeePerCase = 10500;
  let currentCases = 100;

  months.forEach((month, index) => {
    const monthsAgo = MONTH_COUNT - 1 - index;
    const isCurrent = monthsAgo === 0;
    const din = daysInMonth(month.date);
    const elapsed = isCurrent ? Math.min(CEO_TODAY.getDate(), din) : din;

    // 直近4ヶ月は新規受け入れが終了件数を上回り、ケースロードが悪化していくシナリオ
    const overloadPhase = monthsAgo <= 3;
    const newCases = Math.max(0, Math.round((overloadPhase ? 8 : 3) + (rng() - 0.5) * 2));
    const lostCases = Math.max(0, Math.round((overloadPhase ? 1 : 3) + (rng() - 0.5) * 1.5));

    const revenueBudget = Math.round(careManagerCount * targetCaseloadPerFte * avgFeePerCase);
    const laborCost = Math.round(revenueBudget * 0.62 * (0.97 + rng() * 0.06));
    const fixedCost = Math.round(revenueBudget * 0.18);
    const profitBudget = Math.round(revenueBudget - revenueBudget * (0.62 + 0.18));

    records.push({
      businessLine: "care_management",
      office,
      month: month.key,
      daysElapsed: elapsed,
      daysInMonth: din,
      currentCases,
      newCases,
      lostCases,
      careManagerCount,
      targetCaseloadPerFte,
      avgFeePerCase: Math.round(avgFeePerCase * (0.99 + rng() * 0.02)),
      revenueBudget,
      profitBudget,
      laborCost,
      fixedCost,
    });

    currentCases = Math.max(0, currentCases + newCases - lostCases);
  });

  return records;
}

/** 通所介護(UCHINOWA)の12ヶ月分モックデータ。直近で稼働率が目標を下回り続ける
 * 定員割れシナリオを含む。 */
function generateDayServiceSeries(office: string, rng: () => number): DayServiceMonthlyMetric[] {
  const months = getCeoMonthSequence();
  const records: DayServiceMonthlyMetric[] = [];
  const capacityPerDay = 25;
  const avgFeePerAttendance = 8500;
  const targetUtilization = CEO_CONFIG.dayService.targetUtilization;
  let currentUsers = 44;

  months.forEach((month, index) => {
    const monthsAgo = MONTH_COUNT - 1 - index;
    const isCurrent = monthsAgo === 0;
    const din = daysInMonth(month.date);
    const elapsed = isCurrent ? Math.min(CEO_TODAY.getDate(), din) : din;
    const operatingDays = din >= 30 ? 25 : 23;
    const operatingDaysElapsed = isCurrent ? Math.round((operatingDays * elapsed) / din) : operatingDays;

    const underUtilizationPhase = monthsAgo <= 2;
    const newUsers = Math.max(0, Math.round(2 + (rng() - 0.5) * 2));
    const endUsers = Math.max(0, Math.round((underUtilizationPhase ? 4 : 2) + (rng() - 0.5) * 1.5));

    const utilization = underUtilizationPhase ? 0.68 + (rng() - 0.5) * 0.05 : 0.86 + (rng() - 0.5) * 0.06;
    const attendanceMtd = Math.round(capacityPerDay * operatingDaysElapsed * Math.min(0.97, Math.max(0.4, utilization)));

    const revenueBudget = Math.round(capacityPerDay * operatingDays * targetUtilization * avgFeePerAttendance);
    const laborCost = Math.round(revenueBudget * 0.5 * (0.97 + rng() * 0.06));
    const variableCost = Math.round(revenueBudget * 0.12 * (0.95 + rng() * 0.1));
    const fixedCost = Math.round(revenueBudget * 0.18);
    const profitBudget = Math.round(revenueBudget - revenueBudget * (0.5 + 0.12 + 0.18));

    records.push({
      businessLine: "day_service",
      office,
      month: month.key,
      daysElapsed: elapsed,
      daysInMonth: din,
      operatingDays,
      capacityPerDay,
      attendanceMtd,
      currentUsers,
      newUsers,
      endUsers,
      avgFeePerAttendance: Math.round(avgFeePerAttendance * (0.99 + rng() * 0.02)),
      revenueBudget,
      profitBudget,
      laborCost,
      variableCost,
      fixedCost,
    });

    currentUsers = Math.max(0, currentUsers + newUsers - endUsers);
  });

  return records;
}

export function generateMockCeoDataset(): CeoDataset {
  const rng = mulberry32(20260904);
  const branchMetrics: BranchMonthlyMetric[] = [];
  BRANCHES.forEach((branch) => {
    branchMetrics.push(...generateBranchSeries(branch, "visiting_nurse", rng));
  });
  HOME_HELP_OFFICES.forEach((office) => {
    branchMetrics.push(...generateBranchSeries(office, "home_help", rng));
  });

  const careManagementMetrics: CareManagementMonthlyMetric[] = [];
  CARE_MANAGEMENT_OFFICES.forEach((office) => {
    careManagementMetrics.push(...generateCareManagementSeries(office, rng));
  });

  const dayServiceMetrics: DayServiceMonthlyMetric[] = [];
  DAY_SERVICE_OFFICES.forEach((office) => {
    dayServiceMetrics.push(...generateDayServiceSeries(office, rng));
  });

  const months = getCeoMonthSequence();
  const currentMonth = months[months.length - 1].key;
  const previousMonth = months[months.length - 2].key;

  const nurseProductivity: NurseProductivityRecord[] = [];
  BRANCHES.forEach((branch) => {
    const count = LOCATION_BASELINE[branch].nurseCount;
    const rate = LOCATION_BASELINE[branch].revenuePerVisitHour;
    nurseProductivity.push(...generateNurseRecords(branch, rng, currentMonth, count, "看護師", rate));
    nurseProductivity.push(...generateNurseRecords(branch, rng, previousMonth, count, "看護師", rate));
  });
  HOME_HELP_OFFICES.forEach((office) => {
    const count = LOCATION_BASELINE[office].nurseCount;
    const rate = LOCATION_BASELINE[office].revenuePerVisitHour;
    nurseProductivity.push(...generateNurseRecords(office, rng, currentMonth, count, "ヘルパー", rate));
    nurseProductivity.push(...generateNurseRecords(office, rng, previousMonth, count, "ヘルパー", rate));
  });

  return {
    branchMetrics,
    careManagementMetrics,
    dayServiceMetrics,
    nurseProductivity,
    loadedAt: new Date().toISOString(),
    source: "mock",
  };
}
