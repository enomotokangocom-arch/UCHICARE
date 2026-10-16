// 損益計算（全社・訪問看護・居宅支援）。設計: docs/mos/02-design.md §4
// - 試算表がある月: 売上・費用とも試算表。業務データ（居宅売上管理表・iBow売上）と照合して状態を決める。
// - 試算表がない月: 売上は業務データ、費用は分類済み銀行明細による推計。
// - 直接費は部門の金額、共通費・本部費は全社金額を配賦基準で配賦。部門の営業利益の合計＝全社営業利益。
import { REVENUE_RECONCILE_ACCOUNT } from "./accounts";
import { segmentIntegrityDiffs, type TbSegment } from "./parsers/trialBalance";
import {
  BUSINESS_UNITS,
  type AccountInfo,
  type BusinessUnit,
  type CostAllocation,
  type CostBehavior,
  type Unit,
  type ValueStatus,
} from "./types";

export type TbRow = { segment: TbSegment; accountName: string; amount: number };
export type OperationalRevenue = { unit: BusinessUnit; amount: number; source: "KYOTAKU_SHEET" | "IBOW_SALES" };
export type BankExpense = {
  accountTitle: string;
  unit: BusinessUnit | null;
  allocation: CostAllocation;
  behavior: CostBehavior | null;
  amount: number;
};

export type AllocationBasis = { method: "REVENUE_SHARE" } | { method: "FIXED_RATIO"; ratios: Record<BusinessUnit, number> };

export type PLInput = {
  yearMonth: string;
  closed: boolean;
  trialBalance: TbRow[] | null;
  operationalRevenue: OperationalRevenue[];
  bankExpenses: BankExpense[];
  accounts: AccountInfo[];
  allocation: { common: AllocationBasis; hq: AllocationBasis };
  tolerance: number;
};

export type ExpenseLine = { accountName: string; allocation: CostAllocation; behavior: CostBehavior | null; amount: number };

export type UnitPL = {
  unit: Unit;
  revenue: number | null;
  revenueStatus: ValueStatus;
  revenueSource: "TRIAL_BALANCE" | "OPERATIONAL" | null;
  directCost: number;
  commonCost: number;
  hqCost: number;
  totalCost: number;
  laborCost: number;
  fixedCost: number;
  variableCost: number;
  unknownBehaviorCost: number;
  contributionProfit: number | null;
  operatingProfit: number | null;
  operatingMargin: number | null;
  laborRatio: number | null;
  expenses: ExpenseLine[];
};

export type RevenueReconciliation = {
  unit: BusinessUnit;
  accountName: string;
  operational: number | null;
  trialBalance: number | null;
  diff: number | null;
  matched: boolean;
};

export type MonthPL = {
  yearMonth: string;
  basis: "TRIAL_BALANCE" | "ESTIMATE" | "NONE";
  status: ValueStatus;
  company: UnitPL;
  units: Record<BusinessUnit, UnitPL>;
  pools: { common: number; hq: number; unallocated: number; shares: Record<BusinessUnit, number> | null };
  reconciliation: {
    revenue: RevenueReconciliation[];
    segmentDiffs: { accountName: string; company: number; units: number; diff: number }[];
    unknownAccounts: string[];
    unreconciledAmount: number;
  };
  notes: string[];
};

const COST_SECTIONS = new Set(["COGS", "SGA"]);
const REVENUE_SECTIONS = new Set(["REVENUE", "REVENUE_ADJUSTMENT"]);

/** 整数（円）を重みで按分する（最大剰余法。合計は必ず amount に一致） */
export function allocateInteger(amount: number, weights: Record<BusinessUnit, number>): Record<BusinessUnit, number> {
  const total = BUSINESS_UNITS.reduce((s, u) => s + weights[u], 0);
  const out = { HOMONKANGO: 0, KYOTAKU: 0 } as Record<BusinessUnit, number>;
  if (total <= 0) throw new Error("配賦の重みの合計が0以下です");
  const sign = amount < 0 ? -1 : 1;
  const abs = Math.abs(amount);
  const raw = BUSINESS_UNITS.map((u) => ({ u, exact: (abs * weights[u]) / total }));
  let assigned = 0;
  for (const r of raw) {
    out[r.u] = Math.floor(r.exact);
    assigned += out[r.u];
  }
  const rest = raw.sort((a, b) => b.exact - Math.floor(b.exact) - (a.exact - Math.floor(a.exact)));
  for (let i = 0; i < abs - assigned; i++) out[rest[i % rest.length].u] += 1;
  for (const u of BUSINESS_UNITS) out[u] *= sign;
  return out;
}

function shareWeights(basis: AllocationBasis, revenue: Record<BusinessUnit, number | null>): Record<BusinessUnit, number> | null {
  if (basis.method === "FIXED_RATIO") return basis.ratios;
  if (BUSINESS_UNITS.some((u) => revenue[u] === null || revenue[u]! < 0)) return null;
  const total = BUSINESS_UNITS.reduce((s, u) => s + (revenue[u] ?? 0), 0);
  if (total <= 0) return null;
  return { HOMONKANGO: revenue.HOMONKANGO!, KYOTAKU: revenue.KYOTAKU! };
}

function buildUnitPL(
  unit: Unit,
  revenue: number | null,
  revenueStatus: ValueStatus,
  revenueSource: UnitPL["revenueSource"],
  expenses: ExpenseLine[],
  complete: boolean,
): UnitPL {
  const sum = (f: (e: ExpenseLine) => boolean) => expenses.filter(f).reduce((s, e) => s + e.amount, 0);
  const directCost = sum((e) => e.allocation === "DIRECT");
  const commonCost = sum((e) => e.allocation === "COMMON");
  const hqCost = sum((e) => e.allocation === "HQ");
  const totalCost = directCost + commonCost + hqCost;
  const laborCost = sum((e) => e.behavior === "LABOR");
  const operatingProfit = revenue === null || !complete ? null : revenue - totalCost;
  return {
    unit,
    revenue,
    revenueStatus,
    revenueSource,
    directCost,
    commonCost,
    hqCost,
    totalCost,
    laborCost,
    fixedCost: sum((e) => e.behavior === "FIXED"),
    variableCost: sum((e) => e.behavior === "VARIABLE"),
    unknownBehaviorCost: sum((e) => e.behavior === null),
    contributionProfit: revenue === null ? null : revenue - directCost,
    operatingProfit,
    operatingMargin: operatingProfit !== null && revenue ? operatingProfit / revenue : null,
    laborRatio: revenue ? laborCost / revenue : null,
    expenses: expenses.filter((e) => e.amount !== 0),
  };
}

function mergeLines(lines: ExpenseLine[]): ExpenseLine[] {
  const map = new Map<string, ExpenseLine>();
  for (const l of lines) {
    const k = `${l.accountName}|${l.allocation}`;
    const cur = map.get(k);
    if (cur) cur.amount += l.amount;
    else map.set(k, { ...l });
  }
  return [...map.values()];
}

export function computeMonthPL(input: PLInput): MonthPL {
  const accounts = new Map(input.accounts.map((a) => [a.name, a]));
  const notes: string[] = [];
  const opRevenue: Record<BusinessUnit, number | null> = { HOMONKANGO: null, KYOTAKU: null };
  for (const r of input.operationalRevenue) opRevenue[r.unit] = (opRevenue[r.unit] ?? 0) + r.amount;

  const unitRevenue: Record<BusinessUnit, number | null> = { HOMONKANGO: null, KYOTAKU: null };
  let companyRevenue: number | null = null;
  const unitLines: Record<BusinessUnit, ExpenseLine[]> = { HOMONKANGO: [], KYOTAKU: [] };
  const companyLines: ExpenseLine[] = [];
  const pools = { common: 0, hq: 0 };
  const pooledLines: ExpenseLine[] = [];
  const unknownAccounts = new Set<string>();
  let segmentDiffs: MonthPL["reconciliation"]["segmentDiffs"] = [];
  let basis: MonthPL["basis"] = "NONE";
  const revenueRecon: RevenueReconciliation[] = [];

  if (input.trialBalance && input.trialBalance.length > 0) {
    basis = "TRIAL_BALANCE";
    const seg = new Map<TbSegment, Map<string, number>>();
    for (const row of input.trialBalance) {
      if (!accounts.has(row.accountName)) {
        unknownAccounts.add(row.accountName);
        continue;
      }
      const m = seg.get(row.segment) ?? new Map<string, number>();
      m.set(row.accountName, (m.get(row.accountName) ?? 0) + row.amount);
      seg.set(row.segment, m);
    }
    const amountOf = (s: TbSegment, name: string) => seg.get(s)?.get(name) ?? 0;
    const sumSection = (s: TbSegment, sections: Set<string>) =>
      [...(seg.get(s)?.entries() ?? [])].filter(([n]) => sections.has(accounts.get(n)!.section)).reduce((t, [, v]) => t + v, 0);

    companyRevenue = sumSection("COMPANY", REVENUE_SECTIONS);
    for (const u of BUSINESS_UNITS) unitRevenue[u] = seg.has(u) ? sumSection(u, REVENUE_SECTIONS) : null;

    const costNames = new Set<string>();
    for (const m of seg.values()) for (const n of m.keys()) if (COST_SECTIONS.has(accounts.get(n)!.section)) costNames.add(n);
    for (const name of costNames) {
      const a = accounts.get(name)!;
      const allocation = a.allocation ?? "COMMON";
      const companyAmount = amountOf("COMPANY", name);
      companyLines.push({ accountName: name, allocation, behavior: a.behavior, amount: companyAmount });
      if (allocation === "DIRECT") {
        for (const u of BUSINESS_UNITS) unitLines[u].push({ accountName: name, allocation, behavior: a.behavior, amount: amountOf(u, name) });
      } else {
        pools[allocation === "HQ" ? "hq" : "common"] += companyAmount;
        pooledLines.push({ accountName: name, allocation, behavior: a.behavior, amount: companyAmount });
      }
    }

    for (const u of BUSINESS_UNITS) {
      const accountName = REVENUE_RECONCILE_ACCOUNT[u];
      const tb = seg.has(u) ? amountOf(u, accountName) : null;
      const op = opRevenue[u];
      const diff = tb !== null && op !== null ? op - tb : null;
      revenueRecon.push({ unit: u, accountName, operational: op, trialBalance: tb, diff, matched: diff !== null && Math.abs(diff) <= input.tolerance });
    }
    segmentDiffs = segmentIntegrityDiffs(
      input.trialBalance
        .filter((r) => accounts.has(r.accountName) && accounts.get(r.accountName)!.section !== "SUBTOTAL")
        .map((r) => ({ ...r, yearMonth: input.yearMonth })),
    ).map(({ accountName, company, units, diff }) => ({ accountName, company, units, diff }));
    if (!seg.has("HOMONKANGO") || !seg.has("KYOTAKU")) notes.push("試算表に部門別の頁がないため、部門別損益は計算できません");
  } else {
    const hasExpense = input.bankExpenses.length > 0;
    const hasRevenue = input.operationalRevenue.length > 0;
    if (hasExpense || hasRevenue) basis = "ESTIMATE";
    for (const u of BUSINESS_UNITS) unitRevenue[u] = opRevenue[u];
    companyRevenue = BUSINESS_UNITS.every((u) => unitRevenue[u] !== null)
      ? BUSINESS_UNITS.reduce((s, u) => s + unitRevenue[u]!, 0)
      : null;
    const missing = BUSINESS_UNITS.filter((u) => unitRevenue[u] === null);
    if (basis === "ESTIMATE" && missing.length) {
      notes.push(`売上データがない部門があります（${missing.map((u) => (u === "HOMONKANGO" ? "訪問看護" : "居宅支援")).join("・")}）。全社売上は表示しません`);
    }
    if (hasExpense) notes.push("費用は銀行明細からの推計です（カード利用分・未払計上・減価償却費は含みません）");
    for (const e of input.bankExpenses) {
      const allocation: CostAllocation = e.allocation === "DIRECT" && !e.unit ? "COMMON" : e.allocation;
      const line: ExpenseLine = { accountName: e.accountTitle, allocation, behavior: e.behavior, amount: e.amount };
      companyLines.push(line);
      if (allocation === "DIRECT" && e.unit) unitLines[e.unit].push(line);
      else {
        pools[allocation === "HQ" ? "hq" : "common"] += e.amount;
        pooledLines.push(line);
      }
    }
    for (const u of BUSINESS_UNITS) {
      revenueRecon.push({ unit: u, accountName: REVENUE_RECONCILE_ACCOUNT[u], operational: opRevenue[u], trialBalance: null, diff: null, matched: false });
    }
  }

  // 共通費・本部費の配賦
  const commonShares = shareWeights(input.allocation.common, unitRevenue);
  const hqShares = shareWeights(input.allocation.hq, unitRevenue);
  let unallocated = 0;
  for (const line of mergeLines(pooledLines)) {
    const shares = line.allocation === "HQ" ? hqShares : commonShares;
    if (!shares) {
      unallocated += line.amount;
      continue;
    }
    const split = allocateInteger(line.amount, shares);
    for (const u of BUSINESS_UNITS) unitLines[u].push({ ...line, amount: split[u] });
  }
  if (unallocated !== 0) notes.push("配賦基準（売上高）が確定しないため、共通費・本部費を部門に配賦できません。部門の営業利益は表示しません");

  const closed = input.closed;
  const unitStatus = (u: BusinessUnit): ValueStatus => {
    if (closed) return "FINAL";
    const r = revenueRecon.find((x) => x.unit === u);
    return basis === "TRIAL_BALANCE" && r?.matched ? "RECONCILED" : "ESTIMATED";
  };
  const units = {} as Record<BusinessUnit, UnitPL>;
  for (const u of BUSINESS_UNITS) {
    units[u] = buildUnitPL(
      u,
      unitRevenue[u],
      unitStatus(u),
      unitRevenue[u] === null ? null : basis === "TRIAL_BALANCE" ? "TRIAL_BALANCE" : "OPERATIONAL",
      mergeLines(unitLines[u]),
      unallocated === 0,
    );
  }
  const status: ValueStatus = closed
    ? "FINAL"
    : BUSINESS_UNITS.every((u) => units[u].revenueStatus === "RECONCILED") && segmentDiffs.length === 0
      ? "RECONCILED"
      : "ESTIMATED";
  const company = buildUnitPL(
    "COMPANY",
    companyRevenue,
    status,
    companyRevenue === null ? null : basis === "TRIAL_BALANCE" ? "TRIAL_BALANCE" : "OPERATIONAL",
    mergeLines(companyLines),
    true,
  );

  const unreconciledAmount =
    revenueRecon.filter((r) => r.diff !== null && !r.matched).reduce((s, r) => s + Math.abs(r.diff!), 0) +
    segmentDiffs.reduce((s, d) => s + Math.abs(d.diff), 0);
  if (unknownAccounts.size) notes.push(`科目マスタにない科目があり計算から除外しました（${[...unknownAccounts].join("、")}）`);

  return {
    yearMonth: input.yearMonth,
    basis,
    status,
    company,
    units,
    pools: { ...pools, unallocated, shares: commonShares },
    reconciliation: { revenue: revenueRecon, segmentDiffs, unknownAccounts: [...unknownAccounts], unreconciledAmount },
    notes,
  };
}
