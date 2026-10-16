// 日付・年月・金額・文字列の正規化。
// 解釈できない値は null ではなく ParseFailure を返し、呼び出し側でエラーとして記録する（補完しない）。

export type Ok<T> = { ok: true; value: T };
export type Fail = { ok: false; reason: string };
export type Result<T> = Ok<T> | Fail;

const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
const fail = (reason: string): Fail => ({ ok: false, reason });

/** 和暦の元年（西暦）。令和元年 = 2019 */
const ERA_BASE: Record<string, number> = { 令和: 2018, 平成: 1988 };

/** NFKC 正規化（半角カナ→全角、全角英数→半角）＋空白の整理 */
export function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .normalize("NFKC")
    .replace(/[\s　]+/g, " ")
    .trim();
}

/** 分類ルール照合用: 正規化後に空白をすべて除去し、英字を大文字に揃える */
export function matchKey(value: unknown): string {
  return normalizeText(value).replace(/\s+/g, "").toUpperCase();
}

export function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.normalize("NFKC").trim() === "";
  return false;
}

/**
 * 金額を整数（円）に変換する。
 * 空欄は ok(null)（＝値なし。0 とは区別する）。
 */
export function parseAmount(value: unknown): Result<number | null> {
  if (isBlank(value)) return ok(null);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return fail(`数値ではありません`);
    if (!Number.isInteger(value)) return fail(`金額に小数が含まれています（${value}）`);
    return ok(value);
  }
  let s = normalizeText(value).replace(/\s/g, "");
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith("△") || s.startsWith("▲") || s.startsWith("-") || s.startsWith("−")) {
    negative = true;
    s = s.slice(1);
  }
  s = s.replace(/^[¥￥]/, "").replace(/円$/, "");
  if (!/^\d{1,3}(,\d{3})*$|^\d+$/.test(s)) return fail(`金額として解釈できません（${String(value)}）`);
  const n = Number(s.replace(/,/g, ""));
  return ok(negative ? -n : n);
}

/** 件数などの非負整数 */
export function parseCount(value: unknown): Result<number | null> {
  const r = parseAmount(value);
  if (!r.ok) return r;
  if (r.value !== null && r.value < 0) return fail(`件数が負の値です（${String(value)}）`);
  return r;
}

/** 暦日（JST）。UTC 0時の Date で表す（DB の DATE 型と一致させるため） */
export type CalendarDate = { y: number; m: number; d: number };

export function toUtcDate(c: CalendarDate): Date {
  return new Date(Date.UTC(c.y, c.m - 1, c.d));
}

export function formatDate(c: CalendarDate): string {
  return `${c.y}-${String(c.m).padStart(2, "0")}-${String(c.d).padStart(2, "0")}`;
}

function validDate(y: number, m: number, d: number): Result<CalendarDate> {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return fail(`存在しない日付です（${y}/${m}/${d}）`);
  }
  return ok({ y, m, d });
}

/**
 * 日付の解釈。
 * - Date オブジェクト（Excel 日付セル。exceljs は UTC 0時で返す）
 * - YYYYMMDD / YYYY/M/D / YYYY-M-D / 令和N年M月D日
 * - M/D/YYYY（仙台銀行明細の表示形式。月が12を超える場合はエラー）
 */
export function parseDate(value: unknown): Result<CalendarDate> {
  if (isBlank(value)) return fail("日付が空欄です");
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return fail("日付が不正です");
    return ok({ y: value.getUTCFullYear(), m: value.getUTCMonth() + 1, d: value.getUTCDate() });
  }
  const s = normalizeText(value).replace(/\s/g, "");
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d{4})(\d{2})(\d{2})$/))) return validDate(+m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/))) return validDate(+m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) return validDate(+m[3], +m[1], +m[2]);
  if ((m = s.match(/^(令和|平成)(元|\d{1,2})年(\d{1,2})月(\d{1,2})日$/))) {
    const year = ERA_BASE[m[1]] + (m[2] === "元" ? 1 : +m[2]);
    return validDate(year, +m[3], +m[4]);
  }
  return fail(`日付として解釈できません（${String(value)}）`);
}

/** 年月 "YYYY-MM" */
export type YearMonth = string;

export function ym(y: number, m: number): YearMonth {
  return `${y}-${String(m).padStart(2, "0")}`;
}

export function parseYearMonth(value: unknown): Result<YearMonth> {
  if (isBlank(value)) return fail("年月が空欄です");
  if (value instanceof Date) {
    return ok(ym(value.getUTCFullYear(), value.getUTCMonth() + 1));
  }
  const s = normalizeText(value).replace(/\s/g, "");
  let m: RegExpMatchArray | null;
  const check = (y: number, mo: number): Result<YearMonth> =>
    mo >= 1 && mo <= 12 && y >= 2000 && y <= 2100 ? ok(ym(y, mo)) : fail(`年月が範囲外です（${String(value)}）`);
  if ((m = s.match(/^(令和|平成)(元|\d{1,2})年(\d{1,2})月(度)?$/))) {
    return check(ERA_BASE[m[1]] + (m[2] === "元" ? 1 : +m[2]), +m[3]);
  }
  if ((m = s.match(/^(\d{4})年(\d{1,2})月$/))) return check(+m[1], +m[2]);
  if ((m = s.match(/^(\d{4})[-/](\d{1,2})$/))) return check(+m[1], +m[2]);
  if ((m = s.match(/^(\d{4})(\d{2})$/))) return check(+m[1], +m[2]);
  return fail(`年月として解釈できません（${String(value)}）`);
}

export function yearMonthOf(c: CalendarDate): YearMonth {
  return ym(c.y, c.m);
}

export function addMonths(value: YearMonth, delta: number): YearMonth {
  const [y, m] = value.split("-").map(Number);
  const idx = y * 12 + (m - 1) + delta;
  return ym(Math.floor(idx / 12), (idx % 12) + 1);
}

export function compareYm(a: YearMonth, b: YearMonth): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** 令和表記（画面表示用） */
export function formatYmJa(value: YearMonth): string {
  const [y, m] = value.split("-").map(Number);
  return `${y}年${m}月`;
}

/** 試算表など文字間に空白が入った科目名を詰める */
export function compactLabel(value: unknown): string {
  return normalizeText(value).replace(/\s+/g, "");
}
