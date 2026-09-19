// Feedback Loop (23章) — ActionのExpected ImpactとActual Impactを比較し、成果判定を行う。
// 純粋関数のみで構成する(LLM不使用、DB非依存)。

import type { ExpectedImpact, ActualImpact } from "./types";

export type ImpactVerdict = "EXCEEDED" | "MET" | "PARTIAL" | "MISSED" | "UNKNOWN";

export const VERDICT_LABELS: Record<ImpactVerdict, string> = {
  EXCEEDED: "目標超過達成",
  MET: "目標達成",
  PARTIAL: "一部達成",
  MISSED: "未達",
  UNKNOWN: "判定不可",
};

/**
 * expected.low/high は改善の方向を符号で表す(例: 稼働率+5〜+10pt、人件費率-5〜-3pt)。
 * どちらの符号でも low<=high を仮定せず、区間として正規化してから判定する。
 */
export function evaluateImpact(
  expected: ExpectedImpact | null | undefined,
  actual: ActualImpact | null | undefined,
): ImpactVerdict {
  if (!expected || !actual) return "UNKNOWN";
  if (expected.metric !== actual.metric) return "UNKNOWN";

  const lower = Math.min(expected.low, expected.high);
  const upper = Math.max(expected.low, expected.high);
  const directionPositive = expected.low + expected.high >= 0;
  const v = actual.value;

  if (directionPositive) {
    if (v > upper) return "EXCEEDED";
    if (v >= lower) return "MET";
    if (v > 0) return "PARTIAL";
    return "MISSED";
  }

  if (v < lower) return "EXCEEDED";
  if (v <= upper) return "MET";
  if (v < 0) return "PARTIAL";
  return "MISSED";
}
