import { describe, expect, it } from "vitest";
import { fitLinearTrend, forecastLinear, forecastLinearWithInterval } from "./simple-forecast";

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

describe("forecastLinearWithInterval", () => {
  it("完全な直線データは区間幅がほぼ0", () => {
    const result = forecastLinearWithInterval([10, 20, 30, 40, 50], 1, 0.8);
    expect(result).not.toBeNull();
    expect(result!.value).toBeCloseTo(60, 5);
    expect(result!.high - result!.low).toBeCloseTo(0, 5);
  });

  it("ばらつきのあるデータは区間幅が正になる", () => {
    const result = forecastLinearWithInterval([10, 22, 28, 41, 48], 1, 0.8);
    expect(result).not.toBeNull();
    expect(result!.high).toBeGreaterThan(result!.value);
    expect(result!.low).toBeLessThan(result!.value);
  });

  it("信頼水準が高いほど区間が広い", () => {
    const values = [10, 22, 28, 41, 48];
    const narrow = forecastLinearWithInterval(values, 1, 0.8)!;
    const wide = forecastLinearWithInterval(values, 1, 0.95)!;
    expect(wide.high - wide.low).toBeGreaterThan(narrow.high - narrow.low);
  });

  it("有効な点が3点未満はnull", () => {
    expect(forecastLinearWithInterval([10, 20], 1)).toBeNull();
  });

  it("遠い将来ほど区間が広がる", () => {
    const values = [10, 22, 28, 41, 48];
    const near = forecastLinearWithInterval(values, 1)!;
    const far = forecastLinearWithInterval(values, 6)!;
    expect(far.high - far.low).toBeGreaterThan(near.high - near.low);
  });
});
