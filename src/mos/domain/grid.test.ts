import { describe, expect, it } from "vitest";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import ExcelJS from "exceljs";
import { readFormulaResults, readXlsx } from "./grid";

/** exceljs で作った xlsx の XML を書き換え、実ファイルと同じ「計算結果 0 の数式セル」と「自己終了タグのセル」を作る */
async function workbookWithZeroFormula(): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("売上管理表 8月 ");
  ws.getCell("A1").value = 5;
  ws.getCell("B1").value = { formula: "A1*2", result: 10 };
  const files = unzipSync(new Uint8Array(await wb.xlsx.writeBuffer()));
  const path = Object.keys(files).find((f) => /^xl\/worksheets\/sheet\d+\.xml$/.test(f))!;
  const xml = strFromU8(files[path]).replace(
    /<\/row>/,
    '<c r="C1" s="0"/><c r="D1"><f>SUM(E1:E2)</f><v>0</v></c><c r="E1" t="str"><f>"x"</f><v>文字</v></c></row>',
  );
  files[path] = strToU8(xml);
  return zipSync(files);
}

describe("xlsx の読み込み", () => {
  it("計算結果が 0 の数式セルを 0 として読む（exceljs が読み落とす値を XML から補う）", async () => {
    const data = await workbookWithZeroFormula();
    const results = readFormulaResults(data).get("売上管理表 8月 ")!;
    expect(results.get("D1")).toBe(0);
    expect(results.get("E1")).toBe("文字");
    expect(results.has("C1")).toBe(false); // 自己終了タグのセルに隣のセルの値を割り当てない
    const [sheet] = await readXlsx(data);
    expect(sheet.rows[0]).toEqual([5, 10, null, 0, "文字"]);
  });
});
