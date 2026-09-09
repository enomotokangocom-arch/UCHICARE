// Scenario Simulator — 13章。すべて Calculation Engine の延長として決定論的に計算する(LLM不使用)。

export type ScenarioType =
  | "HIRE_NURSE"
  | "RESIGNATION"
  | "PATIENT_INCREASE"
  | "PATIENT_DECREASE"
  | "PRICE_CHANGE"
  | "NEW_STATION"
  | "SALARY_INCREASE"
  | "INCENTIVE_CHANGE";

export interface ScenarioParamsByType {
  HIRE_NURSE: { count: number };
  RESIGNATION: { count: number };
  PATIENT_INCREASE: { count: number };
  PATIENT_DECREASE: { count: number };
  PRICE_CHANGE: { pctChange: number };
  NEW_STATION: { estimatedMonthlyRevenue: number; estimatedMonthlyLaborCost: number };
  SALARY_INCREASE: { pctChange: number };
  INCENTIVE_CHANGE: { monthlyAmount: number };
}

export interface ScenarioBaseline {
  revenue3mo: number | null;
  laborCost3mo: number | null;
  patientCount3mo: number | null;
  otherCosts: number; // 固定費+変動費(現状維持と仮定)
  nurseCount: number | null;
  utilizationRate: number | null;
  avgSalaryPerNurse: number;
  revenuePerPatient: number | null;
}

export interface ScenarioProjection {
  revenue: number | null;
  laborCost: number | null;
  operatingProfit: number | null;
  operatingProfitMargin: number | null;
  utilizationRate: number | null;
  patientCount: number | null;
  nurseCount: number | null;
}

export interface ScenarioComparison {
  baseline: ScenarioProjection; // シナリオ適用前(3ヶ月後の何もしない場合のトレンド予測)
  withScenario: ScenarioProjection; // シナリオ適用後
  delta: ScenarioProjection; // withScenario - baseline
}
