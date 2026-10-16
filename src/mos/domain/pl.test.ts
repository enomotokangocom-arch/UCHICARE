import { describe, expect, it } from "vitest";
import { DEFAULT_ACCOUNTS } from "./accounts";
import { parseTrialBalancePages } from "./parsers/trialBalance";
import { allocateInteger, computeMonthPL, type PLInput, type TbRow } from "./pl";
import { trialBalancePages } from "../testing/fixtures";
import { BUSINESS_UNITS } from "./types";

function tbRowsFor(yearMonth: string, pages = trialBalancePages()): TbRow[] {
  const r = parseTrialBalancePages(pages);
  return r.lines.map((l) => ({ segment: l.segment, accountName: l.accountName, amount: l.monthly.find((m) => m.yearMonth === yearMonth)!.amount }));
}

const base: Omit<PLInput, "yearMonth" | "trialBalance"> = {
  closed: false,
  operationalRevenue: [],
  bankExpenses: [],
  accounts: DEFAULT_ACCOUNTS,
  allocation: { common: { method: "REVENUE_SHARE" }, hq: { method: "REVENUE_SHARE" } },
  tolerance: 0,
};

describe("allocateInteger", () => {
  it("按分結果の合計は元の金額と一致する（端数は最大剰余）", () => {
    expect(allocateInteger(100, { HOMONKANGO: 1, KYOTAKU: 2 })).toEqual({ HOMONKANGO: 33, KYOTAKU: 67 });
    expect(allocateInteger(-100, { HOMONKANGO: 1, KYOTAKU: 2 })).toEqual({ HOMONKANGO: -33, KYOTAKU: -67 });
    for (const amount of [1, 7, 999, 123457]) {
      const r = allocateInteger(amount, { HOMONKANGO: 13, KYOTAKU: 7 });
      expect(r.HOMONKANGO + r.KYOTAKU).toBe(amount);
    }
  });
});

describe("試算表ベースの損益", () => {
  const pl = computeMonthPL({ ...base, yearMonth: "2026-08", trialBalance: tbRowsFor("2026-08") });

  it("全社の売上・費用・営業利益は試算表の全社頁と一致する", () => {
    expect(pl.basis).toBe("TRIAL_BALANCE");
    expect(pl.company.revenue).toBe(12880000);
    expect(pl.company.totalCost).toBe(7900000);
    expect(pl.company.operatingProfit).toBe(4980000);
    // 支払利息（営業外）は営業利益に含めない
    expect(pl.company.expenses.find((e) => e.accountName === "支払利息")).toBeUndefined();
  });

  it("直接費・共通費・本部費を区別し、配賦後の部門営業利益の合計＝全社営業利益", () => {
    const hk = pl.units.HOMONKANGO;
    const ky = pl.units.KYOTAKU;
    expect(hk.revenue).toBe(11980000);
    expect(ky.revenue).toBe(900000);
    // 本部費（役員報酬）と共通費（通信費）は売上高比で配賦
    expect(pl.pools).toMatchObject({ hq: 1000000, common: 200000, unallocated: 0 });
    expect(hk.hqCost + ky.hqCost).toBe(1000000);
    expect(hk.commonCost + ky.commonCost).toBe(200000);
    expect(ky.hqCost).toBe(Math.round((1000000 * 900000) / 12880000));
    // 直接費は部門の金額そのまま
    expect(ky.directCost).toBe(700000 + 80000);
    expect(hk.operatingProfit! + ky.operatingProfit!).toBe(pl.company.operatingProfit);
    expect(hk.totalCost + ky.totalCost).toBe(pl.company.totalCost);
  });

  it("人件費・固定費・変動費を集計する", () => {
    expect(pl.company.laborCost).toBe(1000000 + 6200000);
    expect(pl.company.fixedCost).toBe(500000 + 200000);
    expect(pl.company.laborRatio).toBeCloseTo(7200000 / 12880000);
  });

  it("業務データの売上が試算表と一致すれば照合済、差があれば推計のまま差額を出す", () => {
    const matched = computeMonthPL({
      ...base,
      yearMonth: "2026-08",
      trialBalance: tbRowsFor("2026-08"),
      operationalRevenue: [
        { unit: "KYOTAKU", amount: 900000, source: "KYOTAKU_SHEET" },
        { unit: "HOMONKANGO", amount: 12000000, source: "IBOW_SALES" },
      ],
    });
    expect(matched.units.KYOTAKU.revenueStatus).toBe("RECONCILED");
    expect(matched.units.HOMONKANGO.revenueStatus).toBe("RECONCILED");
    expect(matched.status).toBe("RECONCILED");
    expect(matched.reconciliation.unreconciledAmount).toBe(0);

    const diff = computeMonthPL({
      ...base,
      yearMonth: "2026-08",
      trialBalance: tbRowsFor("2026-08"),
      operationalRevenue: [{ unit: "KYOTAKU", amount: 899000, source: "KYOTAKU_SHEET" }],
    });
    expect(diff.units.KYOTAKU.revenueStatus).toBe("ESTIMATED");
    expect(diff.reconciliation.revenue.find((r) => r.unit === "KYOTAKU")).toMatchObject({ operational: 899000, trialBalance: 900000, diff: -1000, matched: false });
    // 訪問看護は業務データ（iBow）が無いため照合できない
    expect(diff.units.HOMONKANGO.revenueStatus).toBe("ESTIMATED");
    expect(diff.status).toBe("ESTIMATED");
    expect(diff.reconciliation.unreconciledAmount).toBe(1000);
  });

  it("確定月は確定値になる", () => {
    const closed = computeMonthPL({ ...base, closed: true, yearMonth: "2026-08", trialBalance: tbRowsFor("2026-08") });
    expect(closed.status).toBe("FINAL");
    expect(BUSINESS_UNITS.every((u) => closed.units[u].revenueStatus === "FINAL")).toBe(true);
  });

  it("全社≠訪問看護＋居宅支援 の差異を照合差異として出す（小計行は除く）", () => {
    const rows = tbRowsFor("2026-08").map((r) => (r.segment === "KYOTAKU" && r.accountName === "地代家賃" ? { ...r, amount: r.amount + 500 } : r));
    const r = computeMonthPL({ ...base, yearMonth: "2026-08", trialBalance: rows });
    expect(r.reconciliation.segmentDiffs).toEqual([{ accountName: "地代家賃", company: 500000, units: 500500, diff: -500 }]);
    expect(r.status).toBe("ESTIMATED");
  });

  it("科目マスタにない科目は計算から除外し、注記する", () => {
    const rows: TbRow[] = [...tbRowsFor("2026-08"), { segment: "COMPANY", accountName: "新しい科目", amount: 100 }];
    const r = computeMonthPL({ ...base, yearMonth: "2026-08", trialBalance: rows });
    expect(r.reconciliation.unknownAccounts).toEqual(["新しい科目"]);
    expect(r.company.totalCost).toBe(7900000);
  });
});

describe("試算表がない月の推計損益", () => {
  it("売上は業務データ、費用は分類済み銀行明細。部門の営業利益の合計＝全社", () => {
    const pl = computeMonthPL({
      ...base,
      yearMonth: "2026-09",
      trialBalance: null,
      operationalRevenue: [
        { unit: "KYOTAKU", amount: 1000000, source: "KYOTAKU_SHEET" },
        { unit: "HOMONKANGO", amount: 9000000, source: "IBOW_SALES" },
      ],
      bankExpenses: [
        { accountTitle: "給料手当", unit: null, allocation: "COMMON", behavior: "LABOR", amount: 5000000 },
        { accountTitle: "保険料", unit: "KYOTAKU", allocation: "DIRECT", behavior: "FIXED", amount: 30000 },
        { accountTitle: "地代家賃", unit: null, allocation: "DIRECT", behavior: "FIXED", amount: 100000 },
      ],
    });
    expect(pl.basis).toBe("ESTIMATE");
    expect(pl.status).toBe("ESTIMATED");
    expect(pl.company.revenue).toBe(10000000);
    expect(pl.company.operatingProfit).toBe(10000000 - 5130000);
    // 部門不明の直接費は共通費として配賦する
    expect(pl.units.KYOTAKU.directCost).toBe(30000);
    expect(pl.units.KYOTAKU.commonCost).toBe(510000);
    expect(pl.units.HOMONKANGO.operatingProfit! + pl.units.KYOTAKU.operatingProfit!).toBe(pl.company.operatingProfit);
    expect(pl.notes.join()).toContain("銀行明細からの推計");
  });

  it("売上データが無い部門があれば全社売上・部門営業利益を出さない（0円にしない）", () => {
    const pl = computeMonthPL({
      ...base,
      yearMonth: "2026-09",
      trialBalance: null,
      operationalRevenue: [{ unit: "KYOTAKU", amount: 1000000, source: "KYOTAKU_SHEET" }],
      bankExpenses: [{ accountTitle: "通信費", unit: null, allocation: "COMMON", behavior: "FIXED", amount: 10000 }],
    });
    expect(pl.company.revenue).toBeNull();
    expect(pl.company.operatingProfit).toBeNull();
    expect(pl.units.KYOTAKU.revenue).toBe(1000000);
    expect(pl.units.KYOTAKU.operatingProfit).toBeNull();
    expect(pl.pools.unallocated).toBe(10000);
  });

  it("データが何もない月は NONE", () => {
    const pl = computeMonthPL({ ...base, yearMonth: "2026-10", trialBalance: null });
    expect(pl.basis).toBe("NONE");
    expect(pl.company.revenue).toBeNull();
  });
});
