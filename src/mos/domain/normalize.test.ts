import { describe, expect, it } from "vitest";
import { addMonths, matchKey, normalizeText, parseAmount, parseDate, parseYearMonth } from "./normalize";
import { fiscalMonths, fiscalYearOf, monthColumnToYearMonth } from "./fiscal";

describe("parseAmount", () => {
  it("カンマ区切り・符号・全角・△を整数にする", () => {
    expect(parseAmount("1,234")).toEqual({ ok: true, value: 1234 });
    expect(parseAmount("-841,825")).toEqual({ ok: true, value: -841825 });
    expect(parseAmount("△500")).toEqual({ ok: true, value: -500 });
    expect(parseAmount("(1,000)")).toEqual({ ok: true, value: -1000 });
    expect(parseAmount("１２３")).toEqual({ ok: true, value: 123 });
    expect(parseAmount("¥2,000")).toEqual({ ok: true, value: 2000 });
    expect(parseAmount(1500)).toEqual({ ok: true, value: 1500 });
    expect(parseAmount(" 11,555 ")).toEqual({ ok: true, value: 11555 });
  });
  it("空欄は値なし（0 と区別する）", () => {
    expect(parseAmount(null)).toEqual({ ok: true, value: null });
    expect(parseAmount("")).toEqual({ ok: true, value: null });
    expect(parseAmount("0")).toEqual({ ok: true, value: 0 });
  });
  it("解釈できない値はエラーにし、補完しない", () => {
    expect(parseAmount("12a").ok).toBe(false);
    expect(parseAmount("1,23").ok).toBe(false);
    expect(parseAmount(12.5).ok).toBe(false);
  });
});

describe("parseDate", () => {
  it("GMO の YYYYMMDD", () => {
    expect(parseDate("20260831")).toEqual({ ok: true, value: { y: 2026, m: 8, d: 31 } });
    expect(parseDate(20260801)).toEqual({ ok: true, value: { y: 2026, m: 8, d: 1 } });
  });
  it("仙台銀行の M/D/YYYY と Excel 日付セル", () => {
    expect(parseDate("8/3/2026")).toEqual({ ok: true, value: { y: 2026, m: 8, d: 3 } });
    expect(parseDate(new Date(Date.UTC(2026, 7, 31)))).toEqual({ ok: true, value: { y: 2026, m: 8, d: 31 } });
  });
  it("その他の形式と和暦", () => {
    expect(parseDate("2026/8/3")).toEqual({ ok: true, value: { y: 2026, m: 8, d: 3 } });
    expect(parseDate("令和8年8月3日")).toEqual({ ok: true, value: { y: 2026, m: 8, d: 3 } });
  });
  it("存在しない日付・解釈できない日付はエラー", () => {
    expect(parseDate("13/1/2026").ok).toBe(false);
    expect(parseDate("20260230").ok).toBe(false);
    expect(parseDate("8月3日").ok).toBe(false);
    expect(parseDate(null).ok).toBe(false);
  });
});

describe("parseYearMonth", () => {
  it("和暦・西暦の年月", () => {
    expect(parseYearMonth("令和8年8月")).toEqual({ ok: true, value: "2026-08" });
    expect(parseYearMonth("令和7年10月")).toEqual({ ok: true, value: "2025-10" });
    expect(parseYearMonth("令和8年２月")).toEqual({ ok: true, value: "2026-02" });
    expect(parseYearMonth("2026年8月")).toEqual({ ok: true, value: "2026-08" });
    expect(parseYearMonth("2026/08")).toEqual({ ok: true, value: "2026-08" });
    expect(parseYearMonth("202608")).toEqual({ ok: true, value: "2026-08" });
  });
  it("未入力のテンプレート表記はエラー", () => {
    expect(parseYearMonth("令和○年○月").ok).toBe(false);
    expect(parseYearMonth("令和8年13月").ok).toBe(false);
  });
});

describe("文字列の正規化", () => {
  it("半角カナを全角にし、照合キーは空白を除去する", () => {
    expect(normalizeText("ｷﾕｳﾌﾘｼｷﾝ")).toBe("キユウフリシキン");
    expect(matchKey("振込 カ）ウチケア")).toBe("振込カ)ウチケア");
    expect(matchKey("ＡＭＡＺＯＮ．ＣＯ．ＪＰ")).toBe("AMAZON.CO.JP");
  });
});

describe("会計年度（6月始まり）", () => {
  it("年月から会計年度を求める", () => {
    expect(fiscalYearOf("2026-06")).toBe(2026);
    expect(fiscalYearOf("2027-05")).toBe(2026);
    expect(fiscalYearOf("2026-05")).toBe(2025);
  });
  it("試算表の月列を年月に変換する", () => {
    expect(monthColumnToYearMonth(2026, 6)).toBe("2026-06");
    expect(monthColumnToYearMonth(2026, 12)).toBe("2026-12");
    expect(monthColumnToYearMonth(2026, 1)).toBe("2027-01");
    expect(fiscalMonths(2026)).toHaveLength(12);
    expect(fiscalMonths(2026)[11]).toBe("2027-05");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
  });
});
