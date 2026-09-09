// Forecast Engine — Phase2簡易実装。
//
// 08章「AIによる推測と計算の分離」の原則どおり、ここではLLMを一切使わず、
// 決定論的な最小二乗線形回帰のみで将来値を計算する。
// 本格的な統計モデル・信頼区間つきの予測はPhase3のForecast Engine本実装で拡張する
// (docs/uchi-os/02-mvp-scope.md Phase3)。DR-02/DR-13/DR-15 のみがこの簡易予測を参照する。

export interface LinearTrend {
  slope: number;
  intercept: number;
}

/** 最小二乗法で {x: 0..n-1, y: values[i]} の直線を当てはめる。null混じりの点は除外する。 */
export function fitLinearTrend(values: (number | null)[]): LinearTrend | null {
  const points = values
    .map((y, x) => ({ x, y }))
    .filter((p): p is { x: number; y: number } => p.y != null && Number.isFinite(p.y));
  if (points.length < 2) return null;

  const n = points.length;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumXX = points.reduce((s, p) => s + p.x * p.x, 0);

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return { slope: 0, intercept: sumY / n };

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

/** 直近の値の並び(古い→新しい)から、`monthsAhead`ヶ月後の値を線形外挿する。 */
export function forecastLinear(values: (number | null)[], monthsAhead: number): number | null {
  const trend = fitLinearTrend(values);
  if (!trend) return null;
  const nextX = values.length - 1 + monthsAhead;
  return trend.slope * nextX + trend.intercept;
}

export interface ForecastInterval {
  value: number;
  low: number;
  high: number;
}

const Z_SCORE: Record<number, number> = { 0.8: 1.28, 0.9: 1.645, 0.95: 1.96 };

/**
 * forecastLinear() に予測区間(prediction interval)を付与した版。
 * 回帰残差から標準誤差を求め、外挿点までの距離に応じて区間を広げる標準的な手法。
 * 有効な実測点が3点未満の場合は区間を計算できないため null を返す。
 */
export function forecastLinearWithInterval(
  values: (number | null)[],
  monthsAhead: number,
  confidenceLevel: 0.8 | 0.9 | 0.95 = 0.8,
): ForecastInterval | null {
  const points = values
    .map((y, x) => ({ x, y }))
    .filter((p): p is { x: number; y: number } => p.y != null && Number.isFinite(p.y));
  if (points.length < 3) return null;

  const trend = fitLinearTrend(values);
  if (!trend) return null;

  const n = points.length;
  const xMean = points.reduce((s, p) => s + p.x, 0) / n;
  const sumSquaredX = points.reduce((s, p) => s + (p.x - xMean) ** 2, 0);
  const residualSumSquares = points.reduce((s, p) => {
    const predicted = trend.slope * p.x + trend.intercept;
    return s + (p.y - predicted) ** 2;
  }, 0);
  const standardError = Math.sqrt(residualSumSquares / (n - 2));

  const nextX = values.length - 1 + monthsAhead;
  const value = trend.slope * nextX + trend.intercept;
  const z = Z_SCORE[confidenceLevel];
  const margin =
    sumSquaredX > 0
      ? z * standardError * Math.sqrt(1 + 1 / n + (nextX - xMean) ** 2 / sumSquaredX)
      : z * standardError;

  return { value, low: value - margin, high: value + margin };
}
