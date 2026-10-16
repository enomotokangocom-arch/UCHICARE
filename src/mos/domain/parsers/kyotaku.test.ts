import { describe, expect, it } from "vitest";
import { readXlsx } from "../grid";
import { buildXlsx, kyotakuSheetRows } from "../../testing/fixtures";
import { isKyotakuWorkbook, parseKyotaku } from "./kyotaku";

async function workbook(sheets: { name: string; rows: ReturnType<typeof kyotakuSheetRows> | { rows: (string | null)[][]; merges: string[] } }[]) {
  return readXlsx(await buildXlsx(sheets.map((s) => ({ name: s.name, rows: s.rows.rows, merges: s.rows.merges }))));
}

describe("居宅売上管理表", () => {
  it("旧版レイアウトのシートを読み、区分ごとの件数・金額と総売上を検算する", async () => {
    const sheets = await workbook([
      { name: "10月", rows: kyotakuSheetRows({ ymLabel: "令和7年10月", care: [20, 300000, 1, 15000], support: [10, 50000, 0, 0], commission: [5, 20000], certification: 0 }) },
    ]);
    expect(isKyotakuWorkbook(sheets)).toBe(true);
    const r = parseKyotaku(sheets);
    expect(r.issues.filter((i) => i.severity === "ERROR")).toEqual([]);
    expect(r.months).toEqual([
      {
        sheet: "10月",
        yearMonth: "2025-10",
        totalAmount: 385000,
        care: { thisMonthCount: 20, thisMonthAmount: 300000, lateCount: 1, lateAmount: 15000, count: 21, amount: 315000 },
        support: { thisMonthCount: 10, thisMonthAmount: 50000, lateCount: 0, lateAmount: 0, count: 10, amount: 50000 },
        commission: { count: 5, amount: 20000 },
        certificationAmount: 0,
      },
    ]);
  });

  it("令和8年6月以降の新版（月後れ単価列あり）も同じ結果になる", async () => {
    const sheets = await workbook([
      { name: "8月", rows: kyotakuSheetRows({ ymLabel: "令和8年8月", care: [30, 400000, 2, 25000], support: [15, 75000, 0, 0], commission: [4, 14000], certification: 0, newLayout: true }) },
    ]);
    const r = parseKyotaku(sheets);
    expect(r.issues.filter((i) => i.severity === "ERROR")).toEqual([]);
    expect(r.months[0]).toMatchObject({ yearMonth: "2026-08", totalAmount: 514000, care: { count: 32, amount: 425000 }, commission: { count: 4, amount: 14000 } });
  });

  it("年月が未入力（令和○年○月）のシート: 金額0なら対象外、金額ありならエラー（推測しない）", async () => {
    const sheets = await workbook([
      { name: "売上管理表", rows: kyotakuSheetRows({ ymLabel: "令和○年○月", care: [0, 0, 0, 0], support: [0, 0, 0, 0] }) },
      { name: "9月", rows: kyotakuSheetRows({ ymLabel: "令和○年○月", care: [5, 50000, 0, 0], support: [1, 5000, 0, 0] }) },
    ]);
    const r = parseKyotaku(sheets);
    expect(r.months).toEqual([]);
    expect(r.issues.find((i) => i.sheet === "売上管理表")!.code).toBe("TEMPLATE_SKIPPED");
    expect(r.issues.find((i) => i.sheet === "9月")).toMatchObject({ severity: "ERROR", code: "YEAR_MONTH_INVALID" });
  });

  it("同じ年月で内容の異なるシートが2つあれば、どちらも取込まない", async () => {
    const sheets = await workbook([
      { name: "8月", rows: kyotakuSheetRows({ ymLabel: "令和8年8月", care: [30, 400000, 0, 0], support: [10, 50000, 0, 0] }) },
      { name: "9月", rows: kyotakuSheetRows({ ymLabel: "令和8年8月", care: [28, 380000, 0, 0], support: [10, 50000, 0, 0] }) },
      { name: "7月", rows: kyotakuSheetRows({ ymLabel: "令和8年7月", care: [29, 390000, 0, 0], support: [10, 50000, 0, 0] }) },
    ]);
    const r = parseKyotaku(sheets);
    expect(r.months.map((m) => m.yearMonth)).toEqual(["2026-07"]);
    expect(r.issues.filter((i) => i.code === "DUPLICATE_YEAR_MONTH").map((i) => i.sheet).sort()).toEqual(["8月", "9月"]);
  });

  it("総売上が区分合計と一致しないシートは取込まない", async () => {
    const sheets = await workbook([
      { name: "8月", rows: kyotakuSheetRows({ ymLabel: "令和8年8月", care: [30, 400000, 0, 0], support: [10, 50000, 0, 0], totalOverride: 450001 }) },
    ]);
    const r = parseKyotaku(sheets);
    expect(r.months).toEqual([]);
    expect(r.issues[0]).toMatchObject({ severity: "ERROR", code: "TOTAL_MISMATCH" });
  });

  it("記入例・コード一覧シートは対象外", async () => {
    const sheets = await workbook([
      { name: "入力方法", rows: kyotakuSheetRows({ ymLabel: "令和7年2月", care: [1, 1000, 0, 0], support: [0, 0, 0, 0] }) },
      { name: "リスト", rows: { rows: [["リスト", null], ["1", "居宅介護支援費"]], merges: [] } },
    ]);
    const r = parseKyotaku(sheets);
    expect(r.months).toEqual([]);
    expect(r.issues.every((i) => i.severity === "INFO")).toBe(true);
  });
});
