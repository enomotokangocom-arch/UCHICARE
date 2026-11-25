/** 営業日(稼働日)の計算。土日・祝日を除く */

/** 祝日(振替休日・国民の休日を含む) */
const HOLIDAYS = new Set([
  // 2025年
  "2025-01-01", "2025-01-13", "2025-02-11", "2025-02-23", "2025-02-24", "2025-03-20", "2025-04-29", "2025-05-03", "2025-05-04",
  "2025-05-05", "2025-05-06", "2025-07-21", "2025-08-11", "2025-09-15", "2025-09-23", "2025-10-13", "2025-11-03", "2025-11-23", "2025-11-24",
  // 2026年
  "2026-01-01", "2026-01-12", "2026-02-11", "2026-02-23", "2026-03-20", "2026-04-29", "2026-05-03", "2026-05-04", "2026-05-05",
  "2026-05-06", "2026-07-20", "2026-08-11", "2026-09-21", "2026-09-22", "2026-09-23", "2026-10-12", "2026-11-03", "2026-11-23",
  // 2027年
  "2027-01-01", "2027-01-11", "2027-02-11", "2027-02-23", "2027-03-21", "2027-03-22", "2027-04-29", "2027-05-03", "2027-05-04",
  "2027-05-05", "2027-07-19", "2027-08-11", "2027-09-20", "2027-09-23", "2027-10-11", "2027-11-03", "2027-11-23",
]);

const pad = (n: number) => String(n).padStart(2, "0");

export function isHoliday(date: string): boolean {
  return HOLIDAYS.has(date);
}

/** 月の最終日(YYYY-MM-DD) */
export function monthEnd(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${month}-${pad(new Date(y, m, 0).getDate())}`;
}

/** 月初から until(含む)までの営業日数。until を省略すると月末まで */
export function businessDays(month: string, until?: string): number {
  const [y, m] = month.split("-").map(Number);
  const last = Math.min(Number((until ?? monthEnd(month)).slice(8)), new Date(y, m, 0).getDate());
  let n = 0;
  for (let d = 1; d <= last; d++) {
    const dow = new Date(y, m - 1, d).getDay();
    if (dow === 0 || dow === 6) continue;
    if (HOLIDAYS.has(`${month}-${pad(d)}`)) continue;
    n++;
  }
  return n;
}

/** 1日あたり(稼働日数で割る)。日数がなければ null */
export function perDay(value: number | null | undefined, days: number | null | undefined): number | null {
  if (value === null || value === undefined || !days) return null;
  return value / days;
}

/** 月の途中までの実績から、月末の着地を見込む(1日あたり × 月の営業日数) */
export function projectMonth(value: number | null | undefined, workDays: number | null | undefined, month: string): number | null {
  const d = perDay(value, workDays);
  return d === null ? null : Math.round(d * businessDays(month));
}
