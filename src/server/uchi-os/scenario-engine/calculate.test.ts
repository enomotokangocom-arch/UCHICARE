import { describe, expect, it } from "vitest";
import { applyScenario, baselineProjection } from "./calculate";
import type { ScenarioBaseline } from "./types";

const baseline: ScenarioBaseline = {
  revenue3mo: 10_000_000,
  laborCost3mo: 5_600_000,
  patientCount3mo: 40,
  otherCosts: 400_000,
  nurseCount: 8,
  utilizationRate: 80,
  avgSalaryPerNurse: 400_000,
  revenuePerPatient: 250_000,
};

describe("baselineProjection", () => {
  it("ベースラインの営業利益を計算する", () => {
    const result = baselineProjection(baseline);
    expect(result.operatingProfit).toBeCloseTo(10_000_000 - 5_600_000 - 400_000, 5);
    expect(result.operatingProfitMargin).toBeCloseTo(((10_000_000 - 5_600_000 - 400_000) / 10_000_000) * 100, 5);
  });
});

describe("applyScenario HIRE_NURSE", () => {
  it("看護師数増加でコスト増・稼働率低下する", () => {
    const result = applyScenario("HIRE_NURSE", { count: 2 }, baseline);
    expect(result.nurseCount).toBe(10);
    expect(result.laborCost).toBeCloseTo(5_600_000 + 2 * 400_000, 5);
    expect(result.utilizationRate!).toBeCloseTo(80 * (8 / 10), 5);
    expect(result.revenue).toBe(10_000_000); // 採用のみでは売上は自動増加しない(保守的な前提)
  });
});

describe("applyScenario RESIGNATION", () => {
  it("退職でコスト減・稼働率上昇する", () => {
    const result = applyScenario("RESIGNATION", { count: 2 }, baseline);
    expect(result.nurseCount).toBe(6);
    expect(result.laborCost).toBeCloseTo(5_600_000 - 2 * 400_000, 5);
    expect(result.utilizationRate!).toBeCloseTo(80 * (8 / 6), 5);
  });

  it("看護師数が0を下回らない", () => {
    const result = applyScenario("RESIGNATION", { count: 20 }, baseline);
    expect(result.nurseCount).toBe(0);
    expect(result.laborCost).toBeGreaterThanOrEqual(0);
  });
});

describe("applyScenario PATIENT_INCREASE / PATIENT_DECREASE", () => {
  it("利用者増加で売上・稼働率が上がる", () => {
    const result = applyScenario("PATIENT_INCREASE", { count: 10 }, baseline);
    expect(result.patientCount).toBe(50);
    expect(result.revenue).toBeCloseTo(10_000_000 + 10 * 250_000, 5);
    expect(result.utilizationRate!).toBeCloseTo(80 * (50 / 40), 5);
  });

  it("利用者減少で売上・稼働率が下がる", () => {
    const result = applyScenario("PATIENT_DECREASE", { count: 10 }, baseline);
    expect(result.patientCount).toBe(30);
    expect(result.revenue).toBeCloseTo(10_000_000 - 10 * 250_000, 5);
  });
});

describe("applyScenario PRICE_CHANGE", () => {
  it("単価アップで売上が増加する", () => {
    const result = applyScenario("PRICE_CHANGE", { pctChange: 5 }, baseline);
    expect(result.revenue).toBeCloseTo(10_000_000 * 1.05, 5);
    expect(result.laborCost).toBe(5_600_000);
  });
});

describe("applyScenario NEW_STATION", () => {
  it("新規出店の売上・コストを加算する", () => {
    const result = applyScenario(
      "NEW_STATION",
      { estimatedMonthlyRevenue: 3_000_000, estimatedMonthlyLaborCost: 2_000_000 },
      baseline,
    );
    expect(result.revenue).toBeCloseTo(13_000_000, 5);
    expect(result.laborCost).toBeCloseTo(7_600_000, 5);
  });
});

describe("applyScenario SALARY_INCREASE / INCENTIVE_CHANGE", () => {
  it("給与アップで人件費が増加する", () => {
    const result = applyScenario("SALARY_INCREASE", { pctChange: 10 }, baseline);
    expect(result.laborCost).toBeCloseTo(5_600_000 * 1.1, 5);
  });

  it("インセンティブ増額で人件費が加算される", () => {
    const result = applyScenario("INCENTIVE_CHANGE", { monthlyAmount: 200_000 }, baseline);
    expect(result.laborCost).toBeCloseTo(5_800_000, 5);
  });
});
