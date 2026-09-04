import { CEO_CONFIG } from "./config";
import { forecastBranchRevenue } from "./forecastEngine";
import { BranchMonthlyMetric, Severity } from "./types";

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)));
}

/** 拠点の月次系列(月昇順)を取り出す。 */
export function branchSeries(metrics: BranchMonthlyMetric[], branch: string): BranchMonthlyMetric[] {
  return metrics.filter((m) => m.branch === branch).sort((a, b) => (a.month < b.month ? -1 : 1));
}

export interface PatientForecastResult {
  branch: string;
  horizonDays: number;
  currentPatients: number;
  expected: number;
  low: number;
  high: number;
}

/** 30/90日利用者予測: 直近3ヶ月の純増減トレンドから Expected/Low/High を算出。 */
export function forecastPatients(series: BranchMonthlyMetric[], horizonDays: number): PatientForecastResult {
  const latest = series[series.length - 1];
  const last3 = series.slice(-3);
  const netChanges = last3.map((m) => m.newPatients + m.resumedPatients - m.dischargedPatients - m.hospitalizedPatients);
  const avgNet = mean(netChanges);
  const sd = stdev(netChanges);
  const latestNetChange = netChanges[netChanges.length - 1] ?? 0;
  const currentPatients = latest.currentPatients + latestNetChange;
  const horizonMonths = horizonDays / 30;

  return {
    branch: latest.branch,
    horizonDays,
    currentPatients: Math.round(currentPatients),
    expected: Math.round(currentPatients + avgNet * horizonMonths),
    low: Math.round(currentPatients + (avgNet - sd) * horizonMonths),
    high: Math.round(currentPatients + (avgNet + sd) * horizonMonths),
  };
}

export interface CapacityGapResult {
  branch: string;
  horizonDays: number;
  avgVisitHoursPerPatient: number;
  futureRequiredVisitHours: number;
  futureAvailableStaffHours: number;
  capacityGapHours: number;
  shortageRatio: number;
  severity: Severity;
}

/** 供給不足予測: h日後時点の月間換算required hoursとavailable hoursの差。 */
export function forecastCapacityGap(series: BranchMonthlyMetric[], horizonDays: number): CapacityGapResult {
  const latest = series[series.length - 1];
  const avgVisitHoursPerPatient = latest.currentPatients > 0 ? latest.visitHours / latest.currentPatients : 0;
  const patientForecast = forecastPatients(series, horizonDays);

  const futureRequiredVisitHours = patientForecast.expected * avgVisitHoursPerPatient;
  const futureAvailableStaffHours = latest.availableHours;
  const capacityGapHours = futureRequiredVisitHours - futureAvailableStaffHours;
  const shortageRatio = futureRequiredVisitHours > 0 ? capacityGapHours / futureRequiredVisitHours : 0;

  let severity: Severity = "green";
  if (shortageRatio >= CEO_CONFIG.capacity.redShortageRatio) severity = "red";
  else if (shortageRatio >= CEO_CONFIG.capacity.yellowShortageRatio) severity = "yellow";

  return {
    branch: latest.branch,
    horizonDays,
    avgVisitHoursPerPatient: Math.round(avgVisitHoursPerPatient * 100) / 100,
    futureRequiredVisitHours: Math.round(futureRequiredVisitHours),
    futureAvailableStaffHours: Math.round(futureAvailableStaffHours),
    capacityGapHours: Math.round(capacityGapHours),
    shortageRatio,
    severity,
  };
}

export interface HiringPlanResult {
  branch: string;
  requiredFte: number;
  shortageHorizonDays: number | null;
  projectedShortageDate: string | null;
  recruitmentStartDate: string | null;
  /** 採用リードタイムを考慮すると、本来はすでに求人を開始しているべき状態(=即対応が必要)。 */
  isRecruitmentOverdue: boolean;
  capacityGaps: CapacityGapResult[];
}

/** 必要採用人数 + 採用開始タイミング。30/60/90日の3点評価。 */
export function computeHiringPlan(series: BranchMonthlyMetric[], today: Date): HiringPlanResult {
  const capacityGaps = CEO_CONFIG.capacity.forecastHorizonDays.map((h) => forecastCapacityGap(series, h));
  const shortage = capacityGaps.find((g) => g.capacityGapHours > 0) ?? null;

  const requiredFte = shortage ? shortage.capacityGapHours / CEO_CONFIG.capacity.avgProductiveHoursPerFte : 0;

  let projectedShortageDate: string | null = null;
  let recruitmentStartDate: string | null = null;
  let isRecruitmentOverdue = false;
  if (shortage) {
    const shortageDate = new Date(today);
    shortageDate.setDate(shortageDate.getDate() + shortage.horizonDays);
    projectedShortageDate = shortageDate.toISOString().slice(0, 10);

    const idealStartDate = new Date(shortageDate);
    idealStartDate.setDate(idealStartDate.getDate() - CEO_CONFIG.capacity.avgHiringLeadTimeDays);
    // 採用リードタイムが確保できず「今日より前」に開始すべき計算結果になった場合は、
    // 過去の日付を提案せず「今日から即開始」として扱う。
    isRecruitmentOverdue = idealStartDate.getTime() < today.getTime();
    const clampedStartDate = isRecruitmentOverdue ? today : idealStartDate;
    recruitmentStartDate = clampedStartDate.toISOString().slice(0, 10);
  }

  return {
    branch: series[series.length - 1]?.branch ?? "",
    requiredFte: Math.round(requiredFte * 100) / 100,
    shortageHorizonDays: shortage?.horizonDays ?? null,
    projectedShortageDate,
    recruitmentStartDate,
    isRecruitmentOverdue,
    capacityGaps,
  };
}

export interface RequiredSalesResult {
  branch: string;
  revenueGap: number;
  avgRevenuePerPatient: number;
  requiredNewPatients: number;
  referralToContractCvr: number;
  salesToReferralCvr: number;
  requiredReferrals: number;
  requiredSalesActivity: number;
  currentSalesActivity: number;
  salesActivityGap: number;
  cvrConfidence: number; // CVRの実データに基づく信頼度(0-1)
}

/** 必要新規利用者数・必要営業量。 */
export function computeRequiredSales(m: BranchMonthlyMetric): RequiredSalesResult {
  const revenue = forecastBranchRevenue(m);
  const revenueGap = Math.max(0, m.revenueBudget - revenue.forecastRevenue);
  const requiredNewPatients = m.avgRevenuePerPatient > 0 ? revenueGap / m.avgRevenuePerPatient : 0;

  const hasReliableCvr = m.referrals >= 3 && m.salesActivities >= 5;
  const referralToContractCvr = hasReliableCvr && m.referrals > 0 ? m.contracts / m.referrals : CEO_CONFIG.sales.fallbackReferralToContractCvr;
  const salesToReferralCvr = hasReliableCvr && m.salesActivities > 0 ? m.referrals / m.salesActivities : CEO_CONFIG.sales.fallbackSalesToReferralCvr;

  const requiredReferrals = referralToContractCvr > 0 ? requiredNewPatients / referralToContractCvr : 0;
  const requiredSalesActivity = salesToReferralCvr > 0 ? requiredReferrals / salesToReferralCvr : 0;

  return {
    branch: m.branch,
    revenueGap: Math.round(revenueGap),
    avgRevenuePerPatient: m.avgRevenuePerPatient,
    requiredNewPatients: Math.round(requiredNewPatients * 10) / 10,
    referralToContractCvr,
    salesToReferralCvr,
    requiredReferrals: Math.round(requiredReferrals * 10) / 10,
    requiredSalesActivity: Math.round(requiredSalesActivity),
    currentSalesActivity: m.salesActivities,
    salesActivityGap: Math.round(requiredSalesActivity - m.salesActivities),
    cvrConfidence: hasReliableCvr ? 0.75 : 0.4,
  };
}
