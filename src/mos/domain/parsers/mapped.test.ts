import { describe, expect, it } from "vitest";
import type { Sheet } from "../grid";
import { aggregateSales, applyMapping, extractHeaderInfo, headerSignature, validateMapping, type ColumnMappingSpec } from "./mapped";

const visitsSheet: Sheet = {
  name: "Sheet1",
  rows: [
    ["訪問日", "利用者ID", "利用者氏名", "住所", "職員番号", "職種", "提供時間", "状態"],
    ["2026/08/01", "U001", "テスト 太郎", "仙台市", "S01", "看護師", "60", "実施"],
    ["2026/08/01", "U002", "テスト 花子", "仙台市", "S01", "看護師", "30", "中止"],
    ["2026/08/02", "U001", "テスト 太郎", "仙台市", "S02", "理学療法士", "40分", "実施"],
    ["2026/08/03", "U003", "テスト 次郎", "仙台市", "S02", "理学療法士", "40", "不明な状態"],
  ],
};

const visitSpec: ColumnMappingSpec = {
  purpose: "VISITS",
  fields: { 訪問日: "visitDate", 利用者ID: "subjectId", 職員番号: "staffId", 職種: "jobType", 提供時間: "minutes", 状態: "status", 利用者氏名: "IGNORE" },
  valueMaps: { status: { 実施: "DONE", 中止: "CANCELLED" }, jobType: { 看護師: "NURSE", 理学療法士: "PT" } },
};

describe("列マッピング方式", () => {
  it("列名と非空件数だけを抽出し、値は含めない。個人情報らしい列を検出する", () => {
    const info = extractHeaderInfo([visitsSheet]);
    expect(info[0].headers).toEqual(["訪問日", "利用者ID", "利用者氏名", "住所", "職員番号", "職種", "提供時間", "状態"]);
    expect(info[0].dataRows).toBe(4);
    expect(info[0].nonEmpty[0]).toBe(4);
    expect(info[0].piiColumns).toEqual([2, 3]);
    expect(JSON.stringify(info)).not.toContain("テスト 太郎");
    expect(headerSignature(info)).toHaveLength(32);
  });

  it("個人情報の列は「取込まない」かIDにしか割り当てられない", () => {
    const info = extractHeaderInfo([visitsSheet]);
    expect(validateMapping(visitSpec, info)).toEqual([]);
    const bad: ColumnMappingSpec = { ...visitSpec, fields: { ...visitSpec.fields, 住所: "unit" } };
    expect(validateMapping(bad, info)[0]).toContain("個人情報");
    const missing: ColumnMappingSpec = { ...visitSpec, fields: { 利用者ID: "subjectId" } };
    expect(validateMapping(missing, info)).toContain("必須項目「訪問日」が割り当てられていません");
  });

  it("訪問記録を読み、ID はハッシュ化し、氏名・住所は出力に含めない", () => {
    const info = extractHeaderInfo([visitsSheet]);
    const r = applyMapping([visitsSheet], info, visitSpec, { hashSecret: "s", defaultUnit: "HOMONKANGO" });
    expect(r.visits).toHaveLength(3);
    expect(r.visits[0]).toMatchObject({ yearMonth: "2026-08", unit: "HOMONKANGO", jobType: "NURSE", minutes: 60, status: "DONE" });
    expect(r.visits[1].status).toBe("CANCELLED");
    expect(r.visits[2].minutes).toBe(40);
    expect(r.visits[0].subjectKey).toBe(r.visits[2].subjectKey);
    expect(r.visits[0].subjectKey).not.toBe("U001");
    const out = JSON.stringify(r);
    expect(out).not.toContain("テスト");
    expect(out).not.toContain("仙台市");
    expect(out).not.toContain("U001");
    // 値の対応表にない状態はエラー（推測しない）
    expect(r.issues).toEqual([expect.objectContaining({ severity: "ERROR", rowNumber: 5, column: "状態" })]);
  });

  it("売上を年月・事業所ごとに集計する", () => {
    const sheet: Sheet = {
      name: "SalesList.csv",
      rows: [
        ["請求年月", "請求額", "区分"],
        ["2026年8月", "1,000", "医療"],
        ["2026年8月", "2,000", "介護"],
        ["2026年7月", "500", "介護"],
        ["2026年7月", "", "介護"],
      ],
    };
    const spec: ColumnMappingSpec = { purpose: "SALES", fields: { 請求年月: "yearMonth", 請求額: "amount" }, valueMaps: {} };
    const info = extractHeaderInfo([sheet]);
    const r = applyMapping([sheet], info, spec, { hashSecret: "s", defaultUnit: "HOMONKANGO" });
    expect(aggregateSales(r.sales)).toEqual([
      { yearMonth: "2026-07", unit: "HOMONKANGO", amount: 500, quantity: null },
      { yearMonth: "2026-08", unit: "HOMONKANGO", amount: 3000, quantity: null },
    ]);
    // 金額が空欄の行は0円にせずエラー
    expect(r.issues).toHaveLength(1);
  });

  it("指標の列を読み、空欄は値なしとして扱う", () => {
    const sheet: Sheet = { name: "a.csv", rows: [["年月", "予定件数", "利用者数"], ["2026/08", "120", null]] };
    const spec: ColumnMappingSpec = { purpose: "METRICS", fields: { 年月: "yearMonth", 予定件数: "metric:VISITS_PLANNED", 利用者数: "metric:USERS" }, valueMaps: {} };
    const r = applyMapping([sheet], extractHeaderInfo([sheet]), spec, { hashSecret: "s", defaultUnit: "HOMONKANGO" });
    expect(r.metrics).toEqual([{ yearMonth: "2026-08", unit: "HOMONKANGO", metricKey: "VISITS_PLANNED", value: 120 }]);
  });
});
