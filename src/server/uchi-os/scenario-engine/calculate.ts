import { operatingProfit as calcOperatingProfit, operatingProfitMargin as calcOperatingProfitMargin } from "@/server/uchi-os/calculation-engine/formulas";
import type { ScenarioBaseline, ScenarioParamsByType, ScenarioProjection, ScenarioType } from "./types";

function toProjection(
  revenue: number | null,
  laborCost: number | null,
  otherCosts: number,
  utilizationRate: number | null,
  patientCount: number | null,
  nurseCount: number | null,
): ScenarioProjection {
  const profit = calcOperatingProfit(revenue, laborCost, otherCosts, 0);
  const margin = calcOperatingProfitMargin(profit.value, revenue);
  return {
    revenue,
    laborCost,
    operatingProfit: profit.value,
    operatingProfitMargin: margin.value,
    utilizationRate,
    patientCount,
    nurseCount,
  };
}

export function baselineProjection(baseline: ScenarioBaseline): ScenarioProjection {
  return toProjection(
    baseline.revenue3mo,
    baseline.laborCost3mo,
    baseline.otherCosts,
    baseline.utilizationRate,
    baseline.patientCount3mo,
    baseline.nurseCount,
  );
}

/**
 * シナリオを3ヶ月後のベースライン予測に適用する。すべて決定論的な四則演算のみで構成される
 * (08章: LLMは計算しない)。各シナリオの前提は 13章のシナリオ一覧・15-phase3実装ノートを参照。
 */
export function applyScenario<T extends ScenarioType>(
  type: T,
  params: ScenarioParamsByType[T],
  baseline: ScenarioBaseline,
): ScenarioProjection {
  const { revenue3mo, laborCost3mo, otherCosts, patientCount3mo, nurseCount, utilizationRate, avgSalaryPerNurse, revenuePerPatient } =
    baseline;

  switch (type) {
    case "HIRE_NURSE": {
      const { count } = params as ScenarioParamsByType["HIRE_NURSE"];
      const newNurseCount = nurseCount != null ? nurseCount + count : null;
      const newLaborCost = laborCost3mo != null ? laborCost3mo + count * avgSalaryPerNurse : null;
      // 需要(訪問時間)は変えず、供給(看護師数)だけ増えるため稼働率は capacity 比で低下する。
      const newUtilization =
        utilizationRate != null && nurseCount != null && newNurseCount != null && newNurseCount > 0
          ? (utilizationRate * nurseCount) / newNurseCount
          : utilizationRate;
      return toProjection(revenue3mo, newLaborCost, otherCosts, newUtilization, patientCount3mo, newNurseCount);
    }

    case "RESIGNATION": {
      const { count } = params as ScenarioParamsByType["RESIGNATION"];
      const newNurseCount = nurseCount != null ? Math.max(0, nurseCount - count) : null;
      const newLaborCost = laborCost3mo != null ? Math.max(0, laborCost3mo - count * avgSalaryPerNurse) : null;
      const newUtilization =
        utilizationRate != null && nurseCount != null && newNurseCount != null && newNurseCount > 0
          ? (utilizationRate * nurseCount) / newNurseCount
          : utilizationRate;
      return toProjection(revenue3mo, newLaborCost, otherCosts, newUtilization, patientCount3mo, newNurseCount);
    }

    case "PATIENT_INCREASE": {
      const { count } = params as ScenarioParamsByType["PATIENT_INCREASE"];
      const newPatientCount = patientCount3mo != null ? patientCount3mo + count : null;
      const revenueDelta = revenuePerPatient != null ? count * revenuePerPatient : 0;
      const newRevenue = revenue3mo != null ? revenue3mo + revenueDelta : null;
      const newUtilization =
        utilizationRate != null && patientCount3mo != null && patientCount3mo > 0 && newPatientCount != null
          ? utilizationRate * (newPatientCount / patientCount3mo)
          : utilizationRate;
      return toProjection(newRevenue, laborCost3mo, otherCosts, newUtilization, newPatientCount, nurseCount);
    }

    case "PATIENT_DECREASE": {
      const { count } = params as ScenarioParamsByType["PATIENT_DECREASE"];
      const newPatientCount = patientCount3mo != null ? Math.max(0, patientCount3mo - count) : null;
      const revenueDelta = revenuePerPatient != null ? count * revenuePerPatient : 0;
      const newRevenue = revenue3mo != null ? Math.max(0, revenue3mo - revenueDelta) : null;
      const newUtilization =
        utilizationRate != null && patientCount3mo != null && patientCount3mo > 0 && newPatientCount != null
          ? utilizationRate * (newPatientCount / patientCount3mo)
          : utilizationRate;
      return toProjection(newRevenue, laborCost3mo, otherCosts, newUtilization, newPatientCount, nurseCount);
    }

    case "PRICE_CHANGE": {
      const { pctChange } = params as ScenarioParamsByType["PRICE_CHANGE"];
      const newRevenue = revenue3mo != null ? revenue3mo * (1 + pctChange / 100) : null;
      return toProjection(newRevenue, laborCost3mo, otherCosts, utilizationRate, patientCount3mo, nurseCount);
    }

    case "NEW_STATION": {
      const { estimatedMonthlyRevenue, estimatedMonthlyLaborCost } = params as ScenarioParamsByType["NEW_STATION"];
      const newRevenue = revenue3mo != null ? revenue3mo + estimatedMonthlyRevenue : estimatedMonthlyRevenue;
      const newLaborCost = laborCost3mo != null ? laborCost3mo + estimatedMonthlyLaborCost : estimatedMonthlyLaborCost;
      return toProjection(newRevenue, newLaborCost, otherCosts, utilizationRate, patientCount3mo, nurseCount);
    }

    case "SALARY_INCREASE": {
      const { pctChange } = params as ScenarioParamsByType["SALARY_INCREASE"];
      const newLaborCost = laborCost3mo != null ? laborCost3mo * (1 + pctChange / 100) : null;
      return toProjection(revenue3mo, newLaborCost, otherCosts, utilizationRate, patientCount3mo, nurseCount);
    }

    case "INCENTIVE_CHANGE": {
      const { monthlyAmount } = params as ScenarioParamsByType["INCENTIVE_CHANGE"];
      const newLaborCost = laborCost3mo != null ? laborCost3mo + monthlyAmount : monthlyAmount;
      return toProjection(revenue3mo, newLaborCost, otherCosts, utilizationRate, patientCount3mo, nurseCount);
    }

    default: {
      const exhaustiveCheck: never = type;
      throw new Error(`未対応のシナリオ種別です: ${exhaustiveCheck}`);
    }
  }
}
