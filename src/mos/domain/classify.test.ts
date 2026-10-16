import { describe, expect, it } from "vitest";
import { DEFAULT_ACCOUNTS, DEFAULT_RULES } from "./accounts";
import { classifyTx, matchInternalTransfers, needsReview, type ClassifiableTx } from "./classify";
import { normalizeText } from "./normalize";

const accounts = new Map(DEFAULT_ACCOUNTS.map((a) => [a.name, a]));
let n = 0;
function tx(p: Partial<ClassifiableTx> & { description: string }): ClassifiableTx {
  return {
    id: `t${++n}`,
    bank: "SENDAI",
    accountId: "A",
    date: "2026-08-10",
    memo: null,
    deposit: 0,
    withdrawal: 1000,
    ...p,
    description: normalizeText(p.description),
  };
}
const classify = (t: ClassifiableTx) => classifyTx(t, DEFAULT_RULES, accounts);

describe("銀行明細の自動分類", () => {
  it("二重計上になる取引を除外カテゴリに分類する", () => {
    expect(classify(tx({ description: "ｱﾒﾂｸｽ" })).category).toBe("CARD_SETTLEMENT");
    expect(classify(tx({ description: "ﾍﾝｻｲｷﾝ 8ｶﾞﾂ" })).category).toBe("LOAN_PRINCIPAL");
    expect(classify(tx({ description: "ｾｲｻｸｺｳｺ(ｺｸ)" })).category).toBe("LOAN_REPAYMENT_MIXED");
    expect(classify(tx({ bank: "GMO", description: "振込 カ）ウチケア", deposit: 5000, withdrawal: 0 })).category).toBe("INTERNAL_TRANSFER");
  });

  it("給与振込は人件費（部門不明のため共通費）", () => {
    expect(classify(tx({ description: "ｷﾕｳﾌﾘｼｷﾝ" }))).toMatchObject({ category: "PAYROLL", accountTitle: "給料手当", behavior: "LABOR", allocation: "COMMON" });
  });

  it("摘要で科目が分かる経費と、部門が分かる経費", () => {
    expect(classify(tx({ description: "ﾌﾘｺﾐﾃｽｳﾘﾖｳ" }))).toMatchObject({ category: "EXPENSE", accountTitle: "支払手数料", behavior: "VARIABLE", allocation: "COMMON" });
    expect(classify(tx({ bank: "GMO", description: "振込 ザイ）カイゴロウドウアンテイセンタ－" }))).toMatchObject({ accountTitle: "保険料", unit: "KYOTAKU", allocation: "DIRECT" });
    expect(classify(tx({ bank: "GMO", description: "Visaデビット利用 GOOGLE*WORKSPACE TEST 承認番号：1" })).accountTitle).toBe("ソフト利用料");
  });

  it("入金は売上入金・その他入金に分け、出金ルールは入金に当てない", () => {
    expect(classify(tx({ description: "ﾐﾔｷﾞｹﾝｺｸﾎﾚﾝ", deposit: 100, withdrawal: 0 })).category).toBe("REVENUE_RECEIPT");
    expect(classify(tx({ description: "ｶ)ｴｽ.ｴﾑ.ｴｽﾌｲﾅﾝｼﾔﾙｻ-ﾋﾞｽ", deposit: 100, withdrawal: 0 })).category).toBe("REVENUE_RECEIPT");
    expect(classify(tx({ description: "ｷﾕｳﾌﾘｼｷﾝ", deposit: 100, withdrawal: 0 })).category).toBe("UNCLASSIFIED");
  });

  it("担当者のメモが科目名ならその科目にする。摘要ルールを優先する", () => {
    expect(classify(tx({ bank: "GMO", description: "Visaデビット利用 テスト店", memo: "会議費" })).accountTitle).toBe("会議費");
    expect(classify(tx({ bank: "GMO", description: "振込 テストフドウサン", memo: "家賃" })).accountTitle).toBe("地代家賃");
    expect(classify(tx({ bank: "GMO", description: "振込手数料", memo: "駐車場代" })).accountTitle).toBe("支払手数料");
  });

  it("ルールに該当しない取引は未分類（推測で科目を付けない）", () => {
    const c = classify(tx({ description: "SMBC(ﾃｽﾄｼﾖｳｼﾞ" }));
    expect(c).toMatchObject({ category: "UNCLASSIFIED", classifiedBy: "NONE" });
    expect(needsReview(c)).toBe(true);
    expect(needsReview({ category: "TAX_SOCIAL", accountTitle: null })).toBe(true);
    expect(needsReview({ category: "EXPENSE", accountTitle: null })).toBe(true);
    expect(needsReview({ category: "EXPENSE", accountTitle: "通信費" })).toBe(false);
  });
});

describe("口座間振替の照合", () => {
  const out = tx({ id: "out", accountId: "SENDAI", description: "ATMﾌﾘｺﾐ", withdrawal: 1500000, date: "2026-08-10" });
  const inn = tx({ id: "in", bank: "GMO", accountId: "GMO", description: "振込 カ）ウチケア", deposit: 1500000, withdrawal: 0, date: "2026-08-10" });

  it("別口座の同額入出金（振替らしい摘要）をペアにする", () => {
    expect(matchInternalTransfers([out, inn])).toEqual([{ outId: "out", inId: "in" }]);
  });

  it("同一口座・金額違い・日付差4日以上・入金が先はペアにしない", () => {
    expect(matchInternalTransfers([out, { ...inn, accountId: "SENDAI" }])).toEqual([]);
    expect(matchInternalTransfers([out, { ...inn, deposit: 1499999 }])).toEqual([]);
    expect(matchInternalTransfers([out, { ...inn, date: "2026-08-14" }])).toEqual([]);
    expect(matchInternalTransfers([out, { ...inn, date: "2026-08-09" }])).toEqual([]);
  });

  it("振替らしい摘要がなければ同額でもペアにしない", () => {
    const rent = tx({ id: "rent", accountId: "SENDAI", description: "ﾃｽﾄﾌﾄﾞｳｻﾝ", withdrawal: 80000 });
    const receipt = tx({ id: "r", bank: "GMO", accountId: "GMO", description: "振込 テスト", deposit: 80000, withdrawal: 0 });
    expect(matchInternalTransfers([rent, receipt])).toEqual([]);
  });

  it("1つの取引は1つのペアにしか使わない（日付が近い組を優先）", () => {
    const inn2 = { ...inn, id: "in2", date: "2026-08-12" };
    expect(matchInternalTransfers([out, inn2, inn])).toEqual([{ outId: "out", inId: "in" }]);
  });
});
