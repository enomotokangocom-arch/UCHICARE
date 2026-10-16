import { describe, expect, it } from "vitest";
import { DEFAULT_ACCOUNTS } from "./accounts";
import { computeKpi, type VisitLite } from "./kpi";
import { computeMonthPL } from "./pl";
import { viewPLForRole, LABOR_GROUP_NAME } from "./view";

const pl = computeMonthPL({
  yearMonth: "2026-08",
  closed: false,
  trialBalance: [
    { segment: "COMPANY", accountName: "訪問看護事業収益", amount: 1000 },
    { segment: "HOMONKANGO", accountName: "訪問看護事業収益", amount: 1000 },
    { segment: "COMPANY", accountName: "居宅介護事業収益", amount: 100 },
    { segment: "KYOTAKU", accountName: "居宅介護事業収益", amount: 100 },
    { segment: "COMPANY", accountName: "役員報酬", amount: 300 },
    { segment: "HOMONKANGO", accountName: "役員報酬", amount: 300 },
    { segment: "COMPANY", accountName: "給料手当", amount: 400 },
    { segment: "HOMONKANGO", accountName: "給料手当", amount: 350 },
    { segment: "KYOTAKU", accountName: "給料手当", amount: 50 },
    { segment: "COMPANY", accountName: "通信費", amount: 10 },
    { segment: "HOMONKANGO", accountName: "通信費", amount: 10 },
  ],
  operationalRevenue: [],
  bankExpenses: [],
  accounts: DEFAULT_ACCOUNTS,
  allocation: { common: { method: "REVENUE_SHARE" }, hq: { method: "REVENUE_SHARE" } },
  tolerance: 0,
});

const v = (p: Partial<VisitLite>): VisitLite => ({ source: "IBOW", kind: "ACTUAL", unit: "HOMONKANGO", jobType: "NURSE", cancelled: false, minutes: 60, subjectKey: "a", ...p });

describe("業務指標", () => {
  it("iBow 実施実績と ZEST 予定を区別して集計する", () => {
    const k = computeKpi({
      yearMonth: "2026-08",
      visits: [
        v({}),
        v({ subjectKey: "b", jobType: "PT", minutes: 40 }),
        v({ cancelled: true }),
        v({ source: "ZEST", kind: "SCHEDULED" }),
        v({ source: "ZEST", kind: "SCHEDULED" }),
        v({ source: "ZEST", kind: "SCHEDULED", cancelled: true }),
      ],
      metrics: [],
      kyotakuBilledUsers: 70,
      capacity: [
        { unit: "HOMONKANGO", jobType: "NURSE", headcount: 1, availableMinutes: 600 },
        { unit: "HOMONKANGO", jobType: "PT", headcount: 1, availableMinutes: 400 },
      ],
      targets: [
        { unit: "COMPANY", metric: "REVENUE", value: 1000 },
        { unit: "COMPANY", metric: "VISITS", value: 4 },
      ],
      pl,
    });
    expect(k.visits).toMatchObject({ actual: 2, scheduled: 2, cancelledActualSource: 1, cancelledScheduleSource: 1 });
    expect(k.users).toEqual({ homonkango: 2, kyotaku: 70 });
    expect(k.utilization.find((u) => u.jobType === "NURSE")!.rate).toBeCloseTo(0.1);
    expect(k.utilization.find((u) => u.jobType === "PT")!.rate).toBeCloseTo(0.1);
    expect(k.targets[0]).toMatchObject({ actual: 1100, rate: 1.1 });
    expect(k.targets[1]).toMatchObject({ actual: 2, rate: 0.5 });
  });

  it("データが無い指標は 0 ではなく null", () => {
    const k = computeKpi({ yearMonth: "2026-08", visits: [], metrics: [], kyotakuBilledUsers: null, capacity: [{ unit: "HOMONKANGO", jobType: "NURSE", headcount: 1, availableMinutes: 600 }], targets: [{ unit: "COMPANY", metric: "VISITS", value: 10 }], pl });
    expect(k.visits.actual).toBeNull();
    expect(k.visits.scheduled).toBeNull();
    expect(k.users).toEqual({ homonkango: null, kyotaku: null });
    expect(k.utilization[0].rate).toBeNull();
    expect(k.targets[0].rate).toBeNull();
  });
});

describe("権限別の表示", () => {
  it("職員には部門別の人件費額・科目明細・照合明細を渡さず、人件費科目は1行にまとめる", () => {
    const staff = viewPLForRole(pl, "STAFF");
    expect(staff.units.KYOTAKU.laborCost).toBeNull();
    expect(staff.units.KYOTAKU.expenses).toEqual([]);
    expect(staff.units.KYOTAKU.laborRatio).toBe(pl.units.KYOTAKU.laborRatio);
    const names = staff.company.expenses.map((e) => e.accountName);
    expect(names).toContain(LABOR_GROUP_NAME);
    expect(names).not.toContain("役員報酬");
    expect(names).not.toContain("給料手当");
    expect(staff.company.expenses.find((e) => e.accountName === LABOR_GROUP_NAME)!.amount).toBe(700);
    expect(staff.reconciliation.revenue).toEqual([]);
  });

  it("経営者・事務には明細を渡す", () => {
    expect(viewPLForRole(pl, "ADMIN")).toBe(pl);
    expect(viewPLForRole(pl, "MANAGER").units.KYOTAKU.laborCost).toBe(pl.units.KYOTAKU.laborCost);
  });
});
