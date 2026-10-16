import { describe, expect, it } from "vitest";
import { trialBalancePages } from "../../testing/fixtures";
import { isTrialBalanceText, parseTrialBalancePages, segmentIntegrityDiffs } from "./trialBalance";

describe("残高試算表（年間推移・部門別）", () => {
  it("年度・部門・月列を読み、6月始まりの年月に変換する", () => {
    const pages = trialBalancePages();
    expect(isTrialBalanceText(pages)).toBe(true);
    const r = parseTrialBalancePages(pages);
    expect(r.issues).toEqual([]);
    expect(r.fiscalYear).toBe(2026);
    const salary = r.lines.find((l) => l.segment === "KYOTAKU" && l.accountName === "給料手当")!;
    expect(salary.monthly.slice(0, 3)).toEqual([
      { yearMonth: "2026-06", amount: 700000 },
      { yearMonth: "2026-07", amount: 700000 },
      { yearMonth: "2026-08", amount: 700000 },
    ]);
    expect(salary.monthly[7]).toEqual({ yearMonth: "2027-01", amount: 0 });
    expect(r.lines.find((l) => l.segment === "COMPANY" && l.accountName === "返戻等")!.monthly[0].amount).toBe(-100000);
  });

  it("全科目0の月は計上済みとして扱わない", () => {
    const r = parseTrialBalancePages(trialBalancePages());
    expect(r.bookedMonths).toEqual(["2026-06", "2026-07", "2026-08"]);
  });

  it("月別＋決算仕訳が当期合計と一致しない行はエラー", () => {
    const r = parseTrialBalancePages(trialBalancePages({ brokenTotal: true }));
    expect(r.issues).toHaveLength(1);
    expect(r.issues[0]).toMatchObject({ code: "TOTAL_MISMATCH", sheet: "1頁" });
    expect(r.lines.some((l) => l.segment === "COMPANY" && l.accountName === "給料手当")).toBe(false);
  });

  it("数値の個数が列見出しと合わない行はエラー", () => {
    const pages = trialBalancePages();
    pages[2].push("雑 費 100 200");
    const r = parseTrialBalancePages(pages);
    expect(r.issues[0].code).toBe("COLUMN_COUNT");
  });

  it("全社＝訪問看護＋居宅支援 の差異を科目ごとに出す", () => {
    const r = parseTrialBalancePages(trialBalancePages());
    const rows = r.lines.flatMap((l) => l.monthly.map((m) => ({ segment: l.segment, accountName: l.accountName, yearMonth: m.yearMonth, amount: m.amount })));
    const diffs = segmentIntegrityDiffs(rows.filter((x) => !["販売管理費計", "営業損益金額"].includes(x.accountName)));
    expect(diffs).toEqual([]);
    const broken = rows.map((x) => (x.segment === "KYOTAKU" && x.accountName === "地代家賃" && x.yearMonth === "2026-08" ? { ...x, amount: x.amount + 1 } : x));
    expect(segmentIntegrityDiffs(broken).find((d) => d.accountName === "地代家賃")).toEqual({
      yearMonth: "2026-08",
      accountName: "地代家賃",
      company: 500000,
      units: 500001,
      diff: -1,
    });
  });
});
