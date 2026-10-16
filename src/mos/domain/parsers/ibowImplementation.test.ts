import { describe, expect, it } from "vitest";
import { readXlsx } from "../grid";
import { buildXlsx, ibowImplementationRows } from "../../testing/fixtures";
import { isIbowImplementation, parseIbowImplementation } from "./ibowImplementation";

describe("iBow 実施報告書", () => {
  it("4行目の見出しから訪問を読み、ID・職員名はハッシュ化し、住所・年齢・氏名は出力しない", async () => {
    const sheets = await readXlsx(await buildXlsx([{ name: "実施報告書", rows: ibowImplementationRows() }]));
    expect(isIbowImplementation(sheets)).toBe(true);
    const r = parseIbowImplementation(sheets, "secret");
    expect(r.issues.filter((i) => i.severity === "ERROR")).toEqual([]);
    expect(r.totalRows).toBe(6);
    expect(r.visits).toHaveLength(6);
    expect(r.visits[0]).toMatchObject({ yearMonth: "2026-09", category: "介護", minutes: 60 });
    expect(r.visits[0].subjectKey).toBe(r.visits[1].subjectKey);
    expect(r.visits[0].dupKey).not.toBe(r.visits[1].dupKey); // 同じ利用者の同日2回の訪問は別の訪問
    const out = JSON.stringify(r);
    for (const pii of ["架空", "9001", "要介護", "テストサービス"]) expect(out).not.toContain(pii);
    // 出力するのは訪問日・ハッシュ化した ID・訪問種別・提供時間だけ（年齢・住所などの項目を持たない）
    expect(Object.keys(r.visits[0]).sort()).toEqual(["category", "date", "dupKey", "minutes", "staffKey", "subjectKey", "yearMonth"]);
    // 提供時間が空欄の訪問は 0 分にせず時間不明として数え、警告を出す
    expect(r.visits[5].minutes).toBeNull();
    expect(r.issues).toEqual([expect.objectContaining({ severity: "WARNING", code: "MISSING_MINUTES" })]);
  });

  it("確認済みでない訪問種別の値はエラー（推測しない）", async () => {
    const rows = ibowImplementationRows();
    rows[4][4] = "不明";
    const r = parseIbowImplementation(await readXlsx(await buildXlsx([{ name: "x", rows }])), "s");
    expect(r.issues[0]).toMatchObject({ severity: "ERROR", rowNumber: 5, column: "訪問種別" });
    expect(r.visits).toHaveLength(5);
  });
});
