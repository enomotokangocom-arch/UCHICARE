import { addMonths, ym, type YearMonth } from "./normalize";

/** 会計年度の開始月。試算表（令和8年度＝6月度〜5月度）で確認済み。 */
export const FISCAL_YEAR_START_MONTH = 6;

/** 年月が属する会計年度（開始年の西暦）。例: 2027-03 → 2026 */
export function fiscalYearOf(value: YearMonth, startMonth = FISCAL_YEAR_START_MONTH): number {
  const [y, m] = value.split("-").map(Number);
  return m >= startMonth ? y : y - 1;
}

/** 会計年度の12か月 */
export function fiscalMonths(fiscalYear: number, startMonth = FISCAL_YEAR_START_MONTH): YearMonth[] {
  const first = ym(fiscalYear, startMonth);
  return Array.from({ length: 12 }, (_, i) => addMonths(first, i));
}

/** 試算表の「N月度」列を、会計年度の年月に変換する */
export function monthColumnToYearMonth(
  fiscalYear: number,
  month: number,
  startMonth = FISCAL_YEAR_START_MONTH,
): YearMonth {
  return month >= startMonth ? ym(fiscalYear, month) : ym(fiscalYear + 1, month);
}

export function reiwaLabel(fiscalYear: number): string {
  return `令和${fiscalYear - 2018}年度`;
}
