/**
 * 07章冒頭「Confidenceの共通算出方法」の実装。
 * confidence = clamp(0.4*dataCompleteness + 0.4*signalStrength + 0.2*historicalPrior, 0, 1)
 * historicalPrior は Phase4 の Feedback Loop が実データに置き換えるまでは既定値0.6を使う。
 */
export function computeConfidence(input: {
  dataCompleteness: number;
  signalStrength: number;
  historicalPrior?: number;
}): number {
  const { dataCompleteness, signalStrength, historicalPrior = 0.6 } = input;
  const raw = 0.4 * dataCompleteness + 0.4 * signalStrength + 0.2 * historicalPrior;
  return Math.min(1, Math.max(0, raw));
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
