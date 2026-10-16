import { describe, expect, it } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { buildXlsx, gmoRows, kyotakuSheetRows, sendaiRows } from "../testing/fixtures";
import { detectByFileName, detectSourceType, loadFile } from "./detect";

describe("種別の自動判別", () => {
  it("内容で銀行明細・居宅売上管理表を判別する（ファイル名に依存しない）", async () => {
    const gmo = await loadFile("statement.xlsx", await buildXlsx([{ name: "s", rows: gmoRows() }]));
    expect(detectSourceType("statement.xlsx", gmo)).toMatchObject({ sourceType: "BANK_GMO", detectedBy: "content" });
    const sendai = await loadFile("8月仙台銀行.xlsx", await buildXlsx([{ name: "s", rows: sendaiRows() }]));
    expect(detectSourceType("8月仙台銀行.xlsx", sendai)).toMatchObject({ sourceType: "BANK_SENDAI", detectedBy: "content+filename" });
    const k = kyotakuSheetRows({ ymLabel: "令和8年8月", care: [1, 1000, 0, 0], support: [0, 0, 0, 0] });
    const kyotaku = await loadFile("売上.xlsx", await buildXlsx([{ name: "8月", rows: k.rows }]));
    expect(detectSourceType("売上.xlsx", kyotaku).sourceType).toBe("KYOTAKU_SALES_XLSX");
  });

  it("ファイル名と内容が食い違う場合は内容を優先し警告する", async () => {
    const f = await loadFile("8月GMO.xlsx", await buildXlsx([{ name: "s", rows: sendaiRows() }]));
    const d = detectSourceType("8月GMO.xlsx", f);
    expect(d.sourceType).toBe("BANK_SENDAI");
    expect(d.issues[0].code).toBe("TYPE_NAME_MISMATCH");
  });

  it("内容確認できる種別の名前なのに内容が一致しなければ取込まない", async () => {
    const f = await loadFile("8月GMO.xlsx", await buildXlsx([{ name: "s", rows: [["a", "b"], [1, 2]] }]));
    expect(detectSourceType("8月GMO.xlsx", f)).toMatchObject({ sourceType: "UNKNOWN" });
  });

  it("列仕様が未確認の iBow・ZEST はファイル名で判別する", () => {
    expect(detectByFileName("SalesList.csv")).toBe("IBOW_SALES_CSV");
    expect(detectByFileName("Implementation (1).xlsx")).toBe("IBOW_IMPLEMENTATION_XLSX");
    expect(detectByFileName("dashboard-経営指標.zip")).toBe("ZEST_METRICS_ZIP");
    // macOS 由来の NFD 表記でも判別できる
    expect(detectByFileName("dashboard-経営指標.zip".normalize("NFD"))).toBe("ZEST_METRICS_ZIP");
    expect(detectByFileName("株式会社テスト_残高試算表(年間推移)部門別含む.pdf")).toBe("TRIAL_BALANCE_PDF");
  });

  it("zip 内の CSV を読み込む", async () => {
    const zip = zipSync({ "a.csv": strToU8("年月,件数\n2026/08,10\n"), "__MACOSX/x": strToU8("") });
    const f = await loadFile("dashboard-経営指標.zip", zip);
    expect(f.kind).toBe("zip");
    if (f.kind === "zip") expect(f.sheets[0].rows[1]).toEqual(["2026/08", "10"]);
    expect(detectSourceType("dashboard-経営指標.zip", f)).toMatchObject({ sourceType: "ZEST_METRICS_ZIP", detectedBy: "filename" });
  });

  it("判別できないファイルは UNKNOWN", async () => {
    const f = await loadFile("memo.csv", strToU8("a,b\n1,2\n"));
    expect(detectSourceType("memo.csv", f).sourceType).toBe("UNKNOWN");
    expect((await loadFile("x.docx", strToU8("hello"))).kind).toBe("unsupported");
  });
});
