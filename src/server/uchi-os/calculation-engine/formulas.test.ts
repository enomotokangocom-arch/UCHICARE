import { describe, expect, it } from "vitest";
import {
  revenueMoM,
  revenuePerNurse,
  netPatientChange,
  utilizationRate,
  laborCostRatio,
  operatingProfit,
  operatingProfitMargin,
  cashRunwayMonths,
  monthlyNetBurn,
  referralRate,
  turnoverRate,
  avgCareDurationDays,
} from "./formulas";

describe("revenueMoM", () => {
  it("計算する（前月比+10%）", () => {
    const result = revenueMoM(1_100_000, 1_000_000);
    expect(result.insufficientData).toBe(false);
    expect(result.value).toBeCloseTo(10, 5);
  });

  it("低下を負の値で表す", () => {
    const result = revenueMoM(920_000, 1_000_000);
    expect(result.value).toBeCloseTo(-8, 5);
  });

  it("前月データが欠損していればinsufficientData", () => {
    const result = revenueMoM(1_000_000, null);
    expect(result.insufficientData).toBe(true);
    expect(result.value).toBeNull();
  });

  it("前月売上が0ならinsufficientData（ゼロ除算防止）", () => {
    const result = revenueMoM(1_000_000, 0);
    expect(result.insufficientData).toBe(true);
    expect(result.value).toBeNull();
  });
});

describe("revenuePerNurse", () => {
  it("FTEが0ならinsufficientData", () => {
    const result = revenuePerNurse(5_000_000, 0);
    expect(result.insufficientData).toBe(true);
  });

  it("正しく計算する", () => {
    const result = revenuePerNurse(5_000_000, 5);
    expect(result.value).toBe(1_000_000);
  });
});

describe("netPatientChange", () => {
  it("新規-終了", () => {
    expect(netPatientChange(8, 5).value).toBe(3);
    expect(netPatientChange(2, 5).value).toBe(-3);
  });

  it("0と0でも欠損扱いにしない（純増0は事実として有効）", () => {
    const result = netPatientChange(0, 0);
    expect(result.insufficientData).toBe(false);
    expect(result.value).toBe(0);
  });
});

describe("utilizationRate", () => {
  it("正常系", () => {
    const result = utilizationRate(6000, 8000);
    expect(result.value).toBeCloseTo(75, 5);
  });

  it("標準稼働可能時間が0ならinsufficientData", () => {
    const result = utilizationRate(6000, 0);
    expect(result.insufficientData).toBe(true);
  });
});

describe("labor cost / operating profit / margin", () => {
  it("人件費率", () => {
    expect(laborCostRatio(600_000, 1_000_000).value).toBeCloseTo(60, 5);
  });

  it("人件費率: 売上0はinsufficientData", () => {
    expect(laborCostRatio(600_000, 0).insufficientData).toBe(true);
  });

  it("営業利益", () => {
    const result = operatingProfit(1_000_000, 600_000, 100_000, 50_000);
    expect(result.value).toBe(250_000);
  });

  it("営業利益率", () => {
    const profit = operatingProfit(1_000_000, 600_000, 100_000, 50_000);
    const margin = operatingProfitMargin(profit.value, 1_000_000);
    expect(margin.value).toBeCloseTo(25, 5);
  });

  it("赤字も正しく計算する", () => {
    const result = operatingProfit(1_000_000, 900_000, 200_000, 50_000);
    expect(result.value).toBe(-150_000);
  });
});

describe("cashRunwayMonths", () => {
  it("正常系: 現預金 ÷ Burn", () => {
    const result = cashRunwayMonths(6_000_000, 1_000_000);
    expect(result.value).toBe(6);
  });

  it("黒字基調(Burn<=0)はInfinityを返す（UI側でRunway良好と表示）", () => {
    const result = cashRunwayMonths(6_000_000, 0);
    expect(result.insufficientData).toBe(false);
    expect(result.value).toBe(Number.POSITIVE_INFINITY);
  });

  it("現預金データがなければinsufficientData", () => {
    const result = cashRunwayMonths(null, 1_000_000);
    expect(result.insufficientData).toBe(true);
  });
});

describe("monthlyNetBurn", () => {
  it("黒字月は0を返す（負の値にならない）", () => {
    const result = monthlyNetBurn(800_000, 1_000_000);
    expect(result.value).toBe(0);
  });

  it("赤字月はBurn額を返す", () => {
    const result = monthlyNetBurn(1_200_000, 1_000_000);
    expect(result.value).toBe(200_000);
  });
});

describe("referralRate", () => {
  it("営業件数0ならinsufficientData", () => {
    expect(referralRate(3, 0).insufficientData).toBe(true);
  });

  it("正常系", () => {
    expect(referralRate(6, 20).value).toBeCloseTo(30, 5);
  });
});

describe("turnoverRate", () => {
  it("月初在籍数0ならinsufficientData", () => {
    expect(turnoverRate(1, 0).insufficientData).toBe(true);
  });

  it("正常系", () => {
    expect(turnoverRate(1, 20).value).toBeCloseTo(5, 5);
  });
});

describe("avgCareDurationDays", () => {
  it("空配列はinsufficientData", () => {
    expect(avgCareDurationDays([]).insufficientData).toBe(true);
  });

  it("平均値を計算する", () => {
    const result = avgCareDurationDays([100, 200, 300]);
    expect(result.value).toBe(200);
  });
});
