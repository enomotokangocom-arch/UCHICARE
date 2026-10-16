// 銀行明細の自動分類と口座間振替の照合。
import type { RuleDef } from "./accounts";
import { matchKey } from "./normalize";
import { EXPENSE_CATEGORIES, type AccountInfo, type Bank, type CostAllocation, type CostBehavior, type TxCategory } from "./types";

export type ClassifiableTx = {
  id: string;
  bank: Bank;
  accountId: string;
  date: string; // YYYY-MM-DD
  description: string;
  memo: string | null;
  deposit: number;
  withdrawal: number;
};

export type Classification = {
  category: TxCategory;
  accountTitle: string | null;
  unit: "HOMONKANGO" | "KYOTAKU" | null;
  allocation: CostAllocation | null;
  behavior: CostBehavior | null;
  classifiedBy: "RULE" | "TRANSFER_MATCH" | "NONE";
  ruleId: string | null;
  transferPairId?: string | null;
};

export const UNCLASSIFIED: Classification = {
  category: "UNCLASSIFIED",
  accountTitle: null,
  unit: null,
  allocation: null,
  behavior: null,
  classifiedBy: "NONE",
  ruleId: null,
};

/** 科目マスタから費用区分の既定値を補う */
export function completeFromAccount(c: Classification, accounts: Map<string, AccountInfo>): Classification {
  if (!c.accountTitle) return c;
  const a = accounts.get(c.accountTitle);
  if (!a) return c;
  return {
    ...c,
    behavior: c.behavior ?? a.behavior,
    allocation: c.allocation ?? (c.unit ? "DIRECT" : a.allocation === "DIRECT" ? "COMMON" : a.allocation),
  };
}

export function classifyTx(
  tx: ClassifiableTx,
  rules: RuleDef[],
  accounts: Map<string, AccountInfo>,
): Classification {
  const direction = tx.deposit > 0 ? "IN" : "OUT";
  const desc = matchKey(tx.description);
  const memo = matchKey(tx.memo ?? "");
  const sorted = [...rules].sort((a, b) => a.priority - b.priority);
  for (const r of sorted) {
    if (r.bank && r.bank !== tx.bank) continue;
    if (r.direction !== "ANY" && r.direction !== direction) continue;
    const target = r.field === "MEMO" ? memo : desc;
    const pattern = matchKey(r.pattern);
    if (!pattern || !target.includes(pattern)) continue;
    return completeFromAccount(
      {
        category: r.category,
        accountTitle: r.accountTitle,
        unit: r.unit,
        allocation: r.allocation,
        behavior: r.behavior,
        classifiedBy: "RULE",
        ruleId: r.id ?? null,
      },
      accounts,
    );
  }
  // メモが科目名そのもの（例:「会議費」「旅費交通費」）なら、その科目の経費とする
  if (direction === "OUT" && tx.memo) {
    const a = accounts.get(matchKey(tx.memo));
    if (a && a.section === "SGA") {
      return completeFromAccount(
        { category: "EXPENSE", accountTitle: a.name, unit: null, allocation: null, behavior: null, classifiedBy: "RULE", ruleId: `memo:${a.name}` },
        accounts,
      );
    }
  }
  return UNCLASSIFIED;
}

/** 確認が必要な取引（未分類、科目未設定の経費、税・社保） */
export function needsReview(c: { category: TxCategory; accountTitle: string | null }): boolean {
  if (c.category === "UNCLASSIFIED" || c.category === "TAX_SOCIAL") return true;
  return EXPENSE_CATEGORIES.includes(c.category) && !c.accountTitle;
}

const TRANSFER_HINTS = ["ATMﾌﾘｺﾐ", "ｳﾁｹｱ", "ﾌﾘｶｴ", "振替"].map(matchKey);

function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

/**
 * 口座間振替のペアを探す。
 * 条件: 別口座で「出金額＝入金額」、入金日が出金日の0〜3日後、どちらかが振替らしい摘要。
 * 1つの取引は1つのペアにしか使わない。日付差が小さい組から確定する。
 */
export function matchInternalTransfers(txs: ClassifiableTx[]): { outId: string; inId: string }[] {
  const outs = txs.filter((t) => t.withdrawal > 0);
  const ins = txs.filter((t) => t.deposit > 0);
  const candidates: { outId: string; inId: string; gap: number }[] = [];
  for (const o of outs) {
    for (const i of ins) {
      if (o.accountId === i.accountId || o.withdrawal !== i.deposit) continue;
      const gap = dayDiff(o.date, i.date);
      if (gap < 0 || gap > 3) continue;
      const hinted = TRANSFER_HINTS.some((h) => matchKey(o.description).includes(h) || matchKey(i.description).includes(h));
      if (!hinted) continue;
      candidates.push({ outId: o.id, inId: i.id, gap });
    }
  }
  candidates.sort((a, b) => a.gap - b.gap);
  const used = new Set<string>();
  const pairs: { outId: string; inId: string }[] = [];
  for (const c of candidates) {
    if (used.has(c.outId) || used.has(c.inId)) continue;
    used.add(c.outId);
    used.add(c.inId);
    pairs.push({ outId: c.outId, inId: c.inId });
  }
  return pairs;
}
