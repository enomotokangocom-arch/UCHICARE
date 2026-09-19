import { describe, expect, it } from "vitest";
import { computeConfidence, DEFAULT_HISTORICAL_PRIOR, applyHistoricalPrior } from "./confidence";

describe("computeConfidence", () => {
  it("historicalPrior省略時は既定値0.6を使う", () => {
    const withDefault = computeConfidence({ dataCompleteness: 0.8, signalStrength: 0.7 });
    const explicit = computeConfidence({ dataCompleteness: 0.8, signalStrength: 0.7, historicalPrior: DEFAULT_HISTORICAL_PRIOR });
    expect(withDefault).toBeCloseTo(explicit, 10);
    expect(withDefault).toBeCloseTo(0.4 * 0.8 + 0.4 * 0.7 + 0.2 * 0.6, 10);
  });

  it("0〜1の範囲にクランプされる", () => {
    expect(computeConfidence({ dataCompleteness: 1, signalStrength: 1, historicalPrior: 1 })).toBe(1);
    expect(computeConfidence({ dataCompleteness: 0, signalStrength: 0, historicalPrior: 0 })).toBe(0);
  });
});

describe("applyHistoricalPrior", () => {
  it("historicalPriorがnullなら変更しない", () => {
    expect(applyHistoricalPrior(0.75, null)).toBe(0.75);
  });

  it("既定値0.6でconfidenceを再計算した場合と数学的に一致する", () => {
    const dataCompleteness = 0.9;
    const signalStrength = 0.5;
    const originalConfidence = computeConfidence({ dataCompleteness, signalStrength });
    const realHistoricalPrior = 0.85;

    const recomputed = computeConfidence({ dataCompleteness, signalStrength, historicalPrior: realHistoricalPrior });
    const adjusted = applyHistoricalPrior(originalConfidence, realHistoricalPrior);

    expect(adjusted).toBeCloseTo(recomputed, 10);
  });

  it("結果は0〜1にクランプされる", () => {
    expect(applyHistoricalPrior(0.95, 1)).toBeLessThanOrEqual(1);
    expect(applyHistoricalPrior(0.05, 0)).toBeGreaterThanOrEqual(0);
  });
});
