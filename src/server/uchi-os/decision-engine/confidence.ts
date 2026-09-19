/**
 * 07章冒頭「Confidenceの共通算出方法」の実装。
 * confidence = clamp(0.4*dataCompleteness + 0.4*signalStrength + 0.2*historicalPrior, 0, 1)
 * historicalPrior は Phase4 の Feedback Loop が実データに置き換えるまでは既定値0.6を使う。
 */
export const DEFAULT_HISTORICAL_PRIOR = 0.6;
const HISTORICAL_PRIOR_WEIGHT = 0.2;

export function computeConfidence(input: {
  dataCompleteness: number;
  signalStrength: number;
  historicalPrior?: number;
}): number {
  const { dataCompleteness, signalStrength, historicalPrior = DEFAULT_HISTORICAL_PRIOR } = input;
  const raw = 0.4 * dataCompleteness + 0.4 * signalStrength + HISTORICAL_PRIOR_WEIGHT * historicalPrior;
  return Math.min(1, Math.max(0, raw));
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * 20ルールの評価関数はすべて historicalPrior の既定値(DEFAULT_HISTORICAL_PRIOR)で
 * computeConfidence()を呼んでいるため、Feedback Loopの実績値(rule-performance.ts)が
 * 得られた後で個別に再計算する代わりに、既定値との差分だけを後から加算する
 * (計算式の重みが固定である限り数学的に等価)。20関数のシグネチャを変更せずに
 * historicalPriorを反映できる。
 */
export function applyHistoricalPrior(confidence: number, historicalPrior: number | null): number {
  if (historicalPrior == null) return confidence;
  return clamp01(confidence + HISTORICAL_PRIOR_WEIGHT * (historicalPrior - DEFAULT_HISTORICAL_PRIOR));
}
