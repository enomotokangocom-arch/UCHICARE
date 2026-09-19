import { describe, expect, it } from "vitest";
import { evaluateImpact } from "./impact-evaluation";
import type { ExpectedImpact, ActualImpact } from "./types";

const increaseExpected: ExpectedImpact = {
  metric: "new_patients",
  label: "新規患者数",
  low: 2,
  high: 4,
  unit: "人",
};

const decreaseExpected: ExpectedImpact = {
  metric: "labor_cost_ratio",
  label: "人件費率",
  low: -5,
  high: -3,
  unit: "pt",
};

function actual(metric: string, value: number): ActualImpact {
  return { metric, value, unit: "" };
}

describe("evaluateImpact", () => {
  it("expected/actualが欠けている場合はUNKNOWN", () => {
    expect(evaluateImpact(null, actual("new_patients", 3))).toBe("UNKNOWN");
    expect(evaluateImpact(increaseExpected, null)).toBe("UNKNOWN");
  });

  it("metricが一致しない場合はUNKNOWN", () => {
    expect(evaluateImpact(increaseExpected, actual("other_metric", 3))).toBe("UNKNOWN");
  });

  it("増加が良い指標: 上限超えでEXCEEDED", () => {
    expect(evaluateImpact(increaseExpected, actual("new_patients", 5))).toBe("EXCEEDED");
  });

  it("増加が良い指標: 区間内でMET", () => {
    expect(evaluateImpact(increaseExpected, actual("new_patients", 3))).toBe("MET");
    expect(evaluateImpact(increaseExpected, actual("new_patients", 2))).toBe("MET");
    expect(evaluateImpact(increaseExpected, actual("new_patients", 4))).toBe("MET");
  });

  it("増加が良い指標: 正だが区間未満でPARTIAL", () => {
    expect(evaluateImpact(increaseExpected, actual("new_patients", 1))).toBe("PARTIAL");
  });

  it("増加が良い指標: 0以下でMISSED", () => {
    expect(evaluateImpact(increaseExpected, actual("new_patients", 0))).toBe("MISSED");
    expect(evaluateImpact(increaseExpected, actual("new_patients", -1))).toBe("MISSED");
  });

  it("減少が良い指標: 下限を下回ればEXCEEDED", () => {
    expect(evaluateImpact(decreaseExpected, actual("labor_cost_ratio", -6))).toBe("EXCEEDED");
  });

  it("減少が良い指標: 区間内でMET", () => {
    expect(evaluateImpact(decreaseExpected, actual("labor_cost_ratio", -4))).toBe("MET");
    expect(evaluateImpact(decreaseExpected, actual("labor_cost_ratio", -3))).toBe("MET");
    expect(evaluateImpact(decreaseExpected, actual("labor_cost_ratio", -5))).toBe("MET");
  });

  it("減少が良い指標: 負だが区間に届かずPARTIAL", () => {
    expect(evaluateImpact(decreaseExpected, actual("labor_cost_ratio", -1))).toBe("PARTIAL");
  });

  it("減少が良い指標: 0以上でMISSED", () => {
    expect(evaluateImpact(decreaseExpected, actual("labor_cost_ratio", 0))).toBe("MISSED");
    expect(evaluateImpact(decreaseExpected, actual("labor_cost_ratio", 1))).toBe("MISSED");
  });
});
