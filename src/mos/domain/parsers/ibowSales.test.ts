import { describe, expect, it } from "vitest";
import iconv from "iconv-lite";
import { detectSourceType, loadFile } from "../detect";
import { salesListCsv } from "../../testing/fixtures";
import { parseIbowSales } from "./ibowSales";

const sjis = (s: string) => new Uint8Array(iconv.encode(s, "Shift_JIS"));

describe("iBow 月次売上（SalesList.csv）", () => {
  it("Shift_JIS を読み、提供月と保険種類別の合計を求め、合計行と検算する", async () => {
    const f = await loadFile("SalesList.csv", sjis(salesListCsv()));
    expect(detectSourceType("SalesList.csv", f)).toMatchObject({ sourceType: "IBOW_SALES_CSV", detectedBy: "content+filename" });
    if (f.kind !== "csv") throw new Error();
    const r = parseIbowSales(f.sheets);
    expect(r.issues).toEqual([]);
    expect(r.totalRows).toBe(4);
    expect(r.month).toEqual({
      yearMonth: "2026-09",
      totalAmount: 220000,
      users: 4,
      byKind: {
        medical: { amount: 70000, visits: 7, selfPay: 21000, users: 2 },
        care: { amount: 120000, visits: 12, selfPay: 12000, users: 2 },
        preventive: { amount: 30000, visits: 3, selfPay: 3000, users: 1 },
        regular: { amount: 0, visits: 0, selfPay: 0, users: 0 },
      },
    });
    // 利用者ID・公費番号は出力に含めない
    const out = JSON.stringify(r);
    expect(out).not.toContain("9001");
    expect(out).not.toContain('"54"');
  });

  it("合計行と一致しなければ取込まない", async () => {
    const f = await loadFile("SalesList.csv", sjis(salesListCsv({ brokenTotal: true })));
    if (f.kind !== "csv") throw new Error();
    const r = parseIbowSales(f.sheets);
    expect(r.month).toBeNull();
    expect(r.issues[0]).toMatchObject({ code: "TOTAL_MISMATCH" });
  });

  it("提供月が読めなければ取込まない", async () => {
    const f = await loadFile("SalesList.csv", sjis(salesListCsv({ month: "未設定" })));
    if (f.kind !== "csv") throw new Error();
    expect(parseIbowSales(f.sheets).issues[0].code).toBe("PERIOD_NOT_FOUND");
  });
});
