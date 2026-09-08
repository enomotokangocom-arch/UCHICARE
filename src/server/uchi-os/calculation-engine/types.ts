/**
 * Calculation Engine の全関数はこの形式で結果を返す。
 * 04章/06章: 重要な経営数値は決定論的に計算し、ゼロ除算・欠損値は
 * 数字を創作せず insufficientData:true として明示する (06.8節)。
 */
export interface KpiResult {
  value: number | null;
  insufficientData: boolean;
}

export function ok(value: number): KpiResult {
  return { value, insufficientData: false };
}

export const insufficient: KpiResult = { value: null, insufficientData: true };

/** 分母が0または非有限、あるいは分子/分母がnullの場合は insufficientData を返す。 */
export function safeDivide(
  numerator: number | null | undefined,
  denominator: number | null | undefined,
  scale = 1,
): KpiResult {
  if (numerator == null || denominator == null || !Number.isFinite(numerator) || !Number.isFinite(denominator)) {
    return insufficient;
  }
  if (denominator === 0) {
    return insufficient;
  }
  return ok((numerator / denominator) * scale);
}
