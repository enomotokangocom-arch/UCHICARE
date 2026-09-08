/** yearMonth は "2026-08" 形式。Phase1では簡略化のためUTCで月境界を扱う（組織のtimezoneは将来対応）。 */
export function monthRange(yearMonth: string): { start: Date; end: Date } {
  const [year, month] = yearMonth.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start, end };
}

export function shiftYearMonth(yearMonth: string, deltaMonths: number): string {
  const [year, month] = yearMonth.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1 + deltaMonths, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function formatYearMonth(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function lastNYearMonths(yearMonth: string, n: number): string[] {
  const result: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    result.push(shiftYearMonth(yearMonth, -i));
  }
  return result;
}
