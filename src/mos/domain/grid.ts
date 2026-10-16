// xlsx / csv を「シート → 行 → セル」の2次元配列に変換する。
// 結合セルは左上（マスター）にだけ値を置き、他は空にする（exceljs は従属セルにも値を複製するため）。
import ExcelJS from "exceljs";
import Papa from "papaparse";

export type CellValue = string | number | boolean | Date | null;
export type Row = CellValue[];
export type Sheet = { name: string; rows: Row[] };

function cellToValue(cell: ExcelJS.Cell): CellValue {
  if (cell.isMerged && cell.master.address !== cell.address) return null;
  const v = cell.value as unknown;
  if (v === null || v === undefined) return null;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  if (v instanceof Date) return v;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("result" in o || "formula" in o || "sharedFormula" in o) {
      const r = o.result;
      if (r === undefined || r === null) return null;
      if (typeof r === "object" && r !== null && "error" in (r as object)) return null;
      return r as CellValue;
    }
    if (Array.isArray(o.richText)) {
      return (o.richText as { text: string }[]).map((t) => t.text).join("");
    }
    if ("text" in o && typeof o.text === "string") return o.text; // ハイパーリンク
    if ("error" in o) return null;
  }
  return String(v);
}

export async function readXlsx(data: Uint8Array): Promise<Sheet[]> {
  const wb = new ExcelJS.Workbook();
  // exceljs の型は Node の Buffer を要求する
  await wb.xlsx.load(Buffer.from(data) as unknown as ArrayBuffer);
  const sheets: Sheet[] = [];
  wb.eachSheet((ws) => {
    const rows: Row[] = [];
    ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      const cells: Row = [];
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        cells[colNumber - 1] = cellToValue(cell);
      });
      for (let i = 0; i < cells.length; i++) if (cells[i] === undefined) cells[i] = null;
      rows[rowNumber - 1] = cells;
    });
    for (let i = 0; i < rows.length; i++) if (rows[i] === undefined) rows[i] = [];
    sheets.push({ name: ws.name, rows });
  });
  return sheets;
}

export type DecodedText = { text: string; encoding: "utf-8" | "shift_jis" };

/** UTF-8（BOM有無）/ Shift_JIS を判定してデコードする */
export function decodeText(data: Uint8Array): DecodedText {
  if (data[0] === 0xef && data[1] === 0xbb && data[2] === 0xbf) {
    return { text: new TextDecoder("utf-8").decode(data.subarray(3)), encoding: "utf-8" };
  }
  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(data), encoding: "utf-8" };
  } catch {
    return { text: new TextDecoder("shift_jis").decode(data), encoding: "shift_jis" };
  }
}

export function readCsv(data: Uint8Array, name = "CSV"): Sheet {
  const { text } = decodeText(data);
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: false });
  const rows: Row[] = parsed.data.map((r) => r.map((c) => (c === "" ? null : c)));
  while (rows.length && rows[rows.length - 1].every((c) => c === null)) rows.pop();
  return { name, rows };
}

/** 行の中から、指定ラベルをすべて含む最初の行を探す（見出し行の検出） */
export function findHeaderRow(
  sheet: Sheet,
  labels: string[],
  normalize: (v: unknown) => string,
  maxScan = 20,
): { rowIndex: number; columns: Map<string, number> } | null {
  for (let r = 0; r < Math.min(sheet.rows.length, maxScan); r++) {
    const row = sheet.rows[r];
    const columns = new Map<string, number>();
    row.forEach((c, i) => {
      const key = normalize(c);
      if (key && !columns.has(key)) columns.set(key, i);
    });
    if (labels.every((l) => columns.has(normalize(l)))) return { rowIndex: r, columns };
  }
  return null;
}
