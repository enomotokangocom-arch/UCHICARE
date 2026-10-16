// 居宅売上管理表パーサ。帳票構造は docs/mos/01-data-spec.md §3。
// 列位置は版によって異なる（令和8年6月以降は「月後れ単価」列が追加）ため、見出しラベルと数値の並び順で読み、
// 検算（今月+月後れ=合計、総売上=区分合計の和）に通らないシートは取込まない。
import type { Sheet } from "../grid";
import { compactLabel, parseAmount, parseYearMonth, type YearMonth } from "../normalize";
import type { Issue } from "../types";

export type BilledBlock = {
  thisMonthCount: number;
  thisMonthAmount: number;
  lateCount: number;
  lateAmount: number;
  count: number;
  amount: number;
};

export type KyotakuMonth = {
  sheet: string;
  yearMonth: YearMonth;
  totalAmount: number;
  care: BilledBlock; // 要介護
  support: BilledBlock; // 要支援
  commission: { count: number; amount: number } | null; // 委託（行が無い版は null）
  certificationAmount: number | null; // 認定調査（行が無い版は null）
};

export type KyotakuParseResult = { months: KyotakuMonth[]; issues: Issue[]; totalRows: number };

/** 実ファイルで確認した、売上データではないシート（記入例・コード一覧） */
export const KYOTAKU_NON_DATA_SHEETS = ["入力方法", "リスト"];

const MARKER = "月間売上表";
const YEARLY_MARKER = "年間売上表";

type Located = { row: number; col: number };

function locate(sheet: Sheet, label: string, maxCol = Infinity, fromRow = 0): Located | null {
  for (let r = fromRow; r < sheet.rows.length; r++) {
    const row = sheet.rows[r];
    for (let c = 0; c < Math.min(row.length, maxCol); c++) {
      if (compactLabel(row[c]) === label) return { row: r, col: c };
    }
  }
  return null;
}

/** ラベルの右側（左ブロック内）にある数値を順に取り出す。数値でない非空セルがあれば null */
function numbersRightOf(sheet: Sheet, at: Located, maxCol: number): number[] | null {
  const out: number[] = [];
  const row = sheet.rows[at.row];
  for (let c = at.col + 1; c < Math.min(row.length, maxCol); c++) {
    const v = row[c];
    const parsed = parseAmount(v);
    if (!parsed.ok) return null;
    if (parsed.value !== null) out.push(parsed.value);
  }
  return out;
}

export function isKyotakuWorkbook(sheets: Sheet[]): boolean {
  return sheets.some((s) => locate(s, MARKER, Infinity) !== null && locate(s, "総売上", Infinity) !== null);
}

export function parseKyotaku(sheets: Sheet[]): KyotakuParseResult {
  const issues: Issue[] = [];
  const candidates: KyotakuMonth[] = [];
  let totalRows = 0;

  for (const sheet of sheets) {
    const marker = locate(sheet, MARKER);
    if (!marker) {
      issues.push({ severity: "INFO", code: "SHEET_SKIPPED", message: "売上表ではないシートのため対象外", sheet: sheet.name });
      continue;
    }
    if (KYOTAKU_NON_DATA_SHEETS.some((n) => compactLabel(sheet.name).includes(n))) {
      issues.push({ severity: "INFO", code: "SHEET_SKIPPED", message: "記入例・一覧シートのため対象外", sheet: sheet.name });
      continue;
    }
    totalRows++;
    const err = (code: string, message: string, rowNumber?: number) =>
      issues.push({ severity: "ERROR", code, message, sheet: sheet.name, rowNumber });

    const yearly = locate(sheet, YEARLY_MARKER, Infinity, marker.row);
    const boundary = yearly && yearly.row === marker.row ? yearly.col : Infinity;

    // 総売上
    const totalAt = locate(sheet, "総売上", boundary, marker.row);
    const totalNums = totalAt ? numbersRightOf(sheet, totalAt, boundary) : null;
    if (!totalAt || !totalNums || totalNums.length < 1) {
      err("TOTAL_NOT_FOUND", "「総売上」の金額が読み取れません", totalAt ? totalAt.row + 1 : undefined);
      continue;
    }
    const totalAmount = totalNums[0];

    // 対象年月（「令和N年M月」セルのみを根拠にする）
    let ymCell: { row: number; text: string } | null = null;
    for (let r = marker.row; r < Math.min(sheet.rows.length, marker.row + 4) && !ymCell; r++) {
      const row = sheet.rows[r];
      for (let c = 0; c < Math.min(row.length, boundary); c++) {
        const text = compactLabel(row[c]);
        if (/^(令和|平成|\d{4}年)/.test(text) && text.includes("月")) {
          ymCell = { row: r, text };
          break;
        }
      }
    }
    if (!ymCell) {
      err("YEAR_MONTH_NOT_FOUND", "対象年月（令和N年M月）のセルが見つかりません");
      continue;
    }
    const ym = parseYearMonth(ymCell.text);
    if (!ym.ok) {
      if (totalAmount === 0) {
        issues.push({ severity: "INFO", code: "TEMPLATE_SKIPPED", message: `対象年月が未入力（${ymCell.text}）で金額も0のため、空のテンプレートとして対象外`, sheet: sheet.name });
      } else {
        err("YEAR_MONTH_INVALID", `対象年月が「${ymCell.text}」のため取込めません。シートの年月セルを入力してください`, ymCell.row + 1);
      }
      continue;
    }

    const block = (label: string): BilledBlock | string => {
      const at = locate(sheet, label, boundary, marker.row + 1);
      if (!at) return `「${label}」行が見つかりません`;
      const nums = numbersRightOf(sheet, at, boundary);
      if (!nums || nums.length !== 6) return `「${label}」行の数値の並びが想定（件数・金額×3組）と異なります`;
      const [c1, a1, c2, a2, c3, a3] = nums;
      if (c1 + c2 !== c3 || a1 + a2 !== a3) return `「${label}」行の今月+月後れ≠合計です`;
      return { thisMonthCount: c1, thisMonthAmount: a1, lateCount: c2, lateAmount: a2, count: c3, amount: a3 };
    };
    const care = block("要介護");
    const support = block("要支援");
    if (typeof care === "string") {
      err("BLOCK_INVALID", care);
      continue;
    }
    if (typeof support === "string") {
      err("BLOCK_INVALID", support);
      continue;
    }

    let commission: KyotakuMonth["commission"] = null;
    const commissionAt = locate(sheet, "委託", boundary, marker.row + 1);
    if (commissionAt) {
      const nums = numbersRightOf(sheet, commissionAt, boundary);
      if (!nums || nums.length !== 2) {
        err("BLOCK_INVALID", "「委託」行の数値の並びが想定（件数・金額）と異なります", commissionAt.row + 1);
        continue;
      }
      commission = { count: nums[0], amount: nums[1] };
    }

    let certificationAmount: number | null = null;
    const certAt = locate(sheet, "認定調査", boundary, marker.row + 1);
    if (certAt) {
      const nums = numbersRightOf(sheet, certAt, boundary);
      if (!nums || nums.length === 0) {
        err("BLOCK_INVALID", "「認定調査」行の金額が読み取れません", certAt.row + 1);
        continue;
      }
      certificationAmount = nums[nums.length - 1];
    }

    const sum = care.amount + support.amount + (commission?.amount ?? 0) + (certificationAmount ?? 0);
    if (sum !== totalAmount) {
      err("TOTAL_MISMATCH", `総売上（${totalAmount.toLocaleString()}円）が区分合計（${sum.toLocaleString()}円）と一致しません`);
      continue;
    }
    candidates.push({ sheet: sheet.name, yearMonth: ym.value, totalAmount, care, support, commission, certificationAmount });
  }

  // 同じ年月のシートが複数ある場合は、どちらが正しいか判断できないため全て取込まない
  const byYm = new Map<string, KyotakuMonth[]>();
  for (const m of candidates) byYm.set(m.yearMonth, [...(byYm.get(m.yearMonth) ?? []), m]);
  const months: KyotakuMonth[] = [];
  for (const [yearMonth, list] of byYm) {
    if (list.length === 1) {
      months.push(list[0]);
      continue;
    }
    const identical = list.every((m) => JSON.stringify({ ...m, sheet: "" }) === JSON.stringify({ ...list[0], sheet: "" }));
    if (identical) {
      months.push(list[0]);
      continue;
    }
    for (const m of list) {
      issues.push({
        severity: "ERROR",
        code: "DUPLICATE_YEAR_MONTH",
        message: `対象年月 ${yearMonth} のシートが複数あり内容が異なります（${list.map((x) => x.sheet).join("、")}）。年月セルを修正してください`,
        sheet: m.sheet,
      });
    }
  }
  months.sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
  return { months, issues, totalRows };
}
