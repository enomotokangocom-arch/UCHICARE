import { describe, expect, it } from "vitest";
import { readCsv, readXlsx } from "../grid";
import { buildXlsx, gmoRows, sendaiRows } from "../../testing/fixtures";
import { describeSendaiAccount, parseGmo, parseSendai } from "./bank";

describe("GMO 明細", () => {
  it("見出し行から列を読み、入出金・残高・メモを取り出す", async () => {
    const sheets = await readXlsx(await buildXlsx([{ name: "statement-101-1-0000001", rows: gmoRows() }]));
    const r = parseGmo(sheets);
    expect(r.issues.filter((i) => i.severity === "ERROR")).toEqual([]);
    expect(r.transactions).toHaveLength(7);
    const fee = r.transactions[0];
    expect(fee).toMatchObject({ bank: "GMO", description: "振込手数料", deposit: 0, withdrawal: 100, balance: 500000, date: { y: 2026, m: 8, d: 31 } });
    expect(fee.accountIdentifier).toBe("statement-101-1-0000001");
    const rent = r.transactions.find((t) => t.memo === "家賃")!;
    expect(rent.withdrawal).toBe(80000);
    // 全角英数・半角カナは NFKC で正規化される
    expect(r.transactions[1].description).toBe("振込 シチジユウシチ ト-ホクガス.カ");
    expect(r.transactions.find((t) => t.deposit === 1000000)!.description).toBe("振込 カ)ウチケア");
  });

  it("入出金が両方空欄・両方あり・日付不正の行はエラーにして取込まない", async () => {
    const rows = gmoRows().slice(0, 2);
    rows.push(["20260830", "テスト", null, null, 1, null]);
    rows.push(["20260830", "テスト", 5, 5, 1, null]);
    rows.push(["2026083", "テスト", null, 5, 1, null]);
    const sheets = await readXlsx(await buildXlsx([{ name: "statement-1-1-1", rows }]));
    const r = parseGmo(sheets);
    expect(r.transactions).toHaveLength(1);
    expect(r.issues.filter((i) => i.severity === "ERROR").map((i) => i.rowNumber)).toEqual([3, 4, 5]);
    expect(r.totalRows).toBe(4);
  });

  it("見出し行がなければエラー", () => {
    const r = parseGmo([{ name: "x", rows: [["a", "b"]] }]);
    expect(r.issues[0].code).toBe("HEADER_NOT_FOUND");
  });
});

describe("仙台銀行 明細", () => {
  it("xlsx を読み、連番・取引区分・メモ（見出し空欄列）を取り出す", async () => {
    const sheets = await readXlsx(await buildXlsx([{ name: "8月仙台銀行", rows: sendaiRows() }]));
    const r = parseSendai(sheets);
    expect(r.issues.filter((i) => i.severity === "ERROR")).toEqual([]);
    expect(r.transactions).toHaveLength(9);
    const atm = r.transactions.find((t) => t.description === "ATMフリコミ")!;
    expect(atm).toMatchObject({ seq: 1, withdrawal: 1000000, deposit: 0, balance: 9650000, txType: "出金" });
    expect(r.transactions.find((t) => t.description === "アメツクス")!.memo).toBe("PC");
    expect(r.transactions.find((t) => t.counterpartyBank === "77")!.deposit).toBe(700000);
    // 摘要が空欄の入金は取引区分を摘要として扱う
    expect(r.transactions.find((t) => t.deposit === 3000)!.description).toBe("（摘要なし・入金）");
  });

  it("過去分の CSV（同じ列構成・Shift_JIS）も読める", async () => {
    const iconv = await import("iconv-lite");
    const csv = sendaiRows()
      .map((r) => r.map((c) => (c === null ? "" : `"${String(c)}"`)).join(","))
      .join("\r\n");
    const sheet = readCsv(new Uint8Array(iconv.encode(csv, "Shift_JIS")), "6月仙台銀行.csv");
    const r = parseSendai([sheet]);
    expect(r.transactions).toHaveLength(9);
    expect(r.transactions[0].description).toBe("セゾン)リ-ス");
  });

  it("口座番号は表示名と分離する", () => {
    expect(describeSendaiAccount("テスト支店（999） 普通 0001234")).toEqual({ label: "仙台銀行 テスト支店(999) 普通", number: "0001234" });
  });
});
