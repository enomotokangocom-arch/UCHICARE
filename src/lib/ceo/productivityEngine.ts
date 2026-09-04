import { CEO_CONFIG } from "./config";
import { BranchMonthlyMetric, NurseProductivityRecord } from "./types";

export interface NurseProductivityScore {
  nurse: string;
  branch: string;
  month: string;
  clinicalUtilization: number; // 訪問提供時間 / 実勤務時間
  revenueProductivity: number; // 訪問売上 / 総勤務時間
  visitProductivity: number; // 訪問件数 / 勤務日数
  travelEfficiency: number; // 訪問時間 / (訪問時間+移動時間)
  isLowProductivity: boolean;
}

/** 単純な訪問件数のみでの評価をしない、4指標合成の生産性スコア。 */
export function scoreNurseProductivity(r: NurseProductivityRecord): NurseProductivityScore {
  const clinicalUtilization = r.workHours > 0 ? r.visitProvidedHours / r.workHours : 0;
  const revenueProductivity = r.workHours > 0 ? r.revenue / r.workHours : 0;
  const visitProductivity = r.workDays > 0 ? r.visitCount / r.workDays : 0;
  const travelEfficiency =
    r.visitProvidedHours + r.travelHours > 0 ? r.visitProvidedHours / (r.visitProvidedHours + r.travelHours) : 0;

  const isLowProductivity =
    clinicalUtilization < CEO_CONFIG.productivity.lowClinicalUtilization ||
    travelEfficiency < CEO_CONFIG.productivity.lowTravelEfficiency;

  return {
    nurse: r.nurse,
    branch: r.branch,
    month: r.month,
    clinicalUtilization,
    revenueProductivity,
    visitProductivity,
    travelEfficiency,
    isLowProductivity,
  };
}

export function scoreAllNurses(records: NurseProductivityRecord[]): NurseProductivityScore[] {
  return records.map(scoreNurseProductivity);
}

export interface BranchUtilization {
  branch: string;
  month: string;
  utilizationRate: number; // 訪問時間 / 訪問提供可能時間
  severity: "green" | "yellow" | "red";
}

export function branchUtilization(m: BranchMonthlyMetric): BranchUtilization {
  const utilizationRate = m.availableHours > 0 ? m.visitHours / m.availableHours : 0;
  let severity: BranchUtilization["severity"] = "green";
  if (utilizationRate < CEO_CONFIG.utilization.redRate) severity = "red";
  else if (utilizationRate < CEO_CONFIG.utilization.yellowRate) severity = "yellow";
  return { branch: m.branch, month: m.month, utilizationRate, severity };
}
