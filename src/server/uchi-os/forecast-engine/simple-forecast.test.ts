import { describe, expect, it } from "vitest";
import { fitLinearTrend, forecastLinear } from "./simple-forecast";

describe("fitLinearTrend", () => {
  it("perfectly linear data", () => {
    const trend = fitLinearTrend([10, 20, 30, 40]);
    expect(trend?.slope).toBeCloseTo(10, 5);
    expect(trend?.intercept).toBeCloseTo(10, 5);
  });

  it("null混じりの点は除外する", () => {
    const trend = fitLinearTrend([10, null, 30, 40]);
    expect(trend).not.toBeNull();
  });

  it("有効な点が1つ以下ならnull", () => {
    expect(fitLinearTrend([10])).toBeNull();
    expect(fitLinearTrend([null, null])).toBeNull();
  });

  it("横ばいデータは傾き0", () => {
    const trend = fitLinearTrend([100, 100, 100]);
    expect(trend?.slope).toBeCloseTo(0, 5);
    expect(trend?.intercept).toBeCloseTo(100, 5);
  });
});

describe("forecastLinear", () => {
  it("将来値を外挿する", () => {
    // x=0..3 -> y=10,20,30,40 (slope=10), 1ヶ月後(x=4) -> 50
    const result = forecastLinear([10, 20, 30, 40], 1);
    expect(result).toBeCloseTo(50, 5);
  });

  it("3ヶ月後の外挿", () => {
    const result = forecastLinear([10, 20, 30, 40], 3);
    expect(result).toBeCloseTo(70, 5);
  });

  it("データ不足ならnull", () => {
    expect(forecastLinear([100], 1)).toBeNull();
  });
});
