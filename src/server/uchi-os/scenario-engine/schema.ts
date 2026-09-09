import { z } from "zod";

export const scenarioRequestSchema = z.object({
  name: z.string().min(1).max(200),
  stationId: z.string().nullable(),
  type: z.enum([
    "HIRE_NURSE",
    "RESIGNATION",
    "PATIENT_INCREASE",
    "PATIENT_DECREASE",
    "PRICE_CHANGE",
    "NEW_STATION",
    "SALARY_INCREASE",
    "INCENTIVE_CHANGE",
  ]),
  params: z.record(z.string(), z.number()),
});

export type ScenarioRequest = z.infer<typeof scenarioRequestSchema>;

export const SCENARIO_TYPE_LABELS: Record<ScenarioRequest["type"], string> = {
  HIRE_NURSE: "看護師採用",
  RESIGNATION: "退職",
  PATIENT_INCREASE: "利用者増加",
  PATIENT_DECREASE: "利用者減少",
  PRICE_CHANGE: "単価変更",
  NEW_STATION: "新規出店",
  SALARY_INCREASE: "給与アップ",
  INCENTIVE_CHANGE: "インセンティブ変更",
};

export const SCENARIO_TYPE_PARAM_FIELDS: Record<ScenarioRequest["type"], { key: string; label: string; unit: string }[]> = {
  HIRE_NURSE: [{ key: "count", label: "採用人数", unit: "人" }],
  RESIGNATION: [{ key: "count", label: "退職人数", unit: "人" }],
  PATIENT_INCREASE: [{ key: "count", label: "増加人数", unit: "人" }],
  PATIENT_DECREASE: [{ key: "count", label: "減少人数", unit: "人" }],
  PRICE_CHANGE: [{ key: "pctChange", label: "単価変更率", unit: "%" }],
  NEW_STATION: [
    { key: "estimatedMonthlyRevenue", label: "想定月間売上", unit: "円" },
    { key: "estimatedMonthlyLaborCost", label: "想定月間人件費", unit: "円" },
  ],
  SALARY_INCREASE: [{ key: "pctChange", label: "昇給率", unit: "%" }],
  INCENTIVE_CHANGE: [{ key: "monthlyAmount", label: "月額インセンティブ", unit: "円" }],
};
