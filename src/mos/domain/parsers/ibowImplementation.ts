// iBow 実施報告書（Implementation.xlsx）パーサ。構造は docs/mos/01-data-spec.md §5（2026年9月分の実ファイルで確認）。
// 1行＝実施した訪問1件。氏名・住所・年齢などの列は読まない。利用者ID・主訪問者（職員名）はハッシュ化する。
import { findHeaderRow, type Sheet } from "../grid";
import { compactLabel, formatDate, normalizeText, parseCount, parseDate, yearMonthOf, type CalendarDate, type YearMonth } from "../normalize";
import { pseudonymize } from "../privacy";
import type { Issue } from "../types";

/** 読み取る列（これ以外の列は値を参照しない） */
export const IBOW_IMPL_HEADERS = ["訪問日", "ID", "訪問種別", "開始時間", "提供時間", "主訪問者"];

/** 実ファイルで確認した訪問種別の値 */
export const IBOW_VISIT_CATEGORIES = ["介護", "医療", "予防", "サ(自)"];

export type IbowVisit = {
  date: CalendarDate;
  yearMonth: YearMonth;
  subjectKey: string;
  staffKey: string;
  category: string;
  minutes: number | null;
  /** 重複判定用（開始時間を含む。開始時間そのものは保存しない） */
  dupKey: string;
};

export type IbowImplResult = { visits: IbowVisit[]; issues: Issue[]; totalRows: number };

const key = (v: unknown) => compactLabel(v);

export function isIbowImplementation(sheets: Sheet[]): boolean {
  return sheets.some((s) => findHeaderRow(s, IBOW_IMPL_HEADERS, key) !== null);
}

export function parseIbowImplementation(sheets: Sheet[], hashSecret: string): IbowImplResult {
  const issues: Issue[] = [];
  const visits: IbowVisit[] = [];
  let totalRows = 0;
  let found = false;
  let missingMinutes = 0;
  for (const sheet of sheets) {
    const header = findHeaderRow(sheet, IBOW_IMPL_HEADERS, key);
    if (!header) continue;
    found = true;
    const col = (h: string) => header.columns.get(key(h))!;
    for (let r = header.rowIndex + 1; r < sheet.rows.length; r++) {
      const row = sheet.rows[r];
      if (row.every((c) => c === null || normalizeText(c) === "")) continue;
      totalRows++;
      const rowNumber = r + 1;
      const err = (column: string, message: string) => issues.push({ severity: "ERROR", code: "INVALID_VALUE", message, sheet: sheet.name, rowNumber, column });
      const date = parseDate(row[col("訪問日")]);
      if (!date.ok) {
        err("訪問日", date.reason);
        continue;
      }
      const subjectKey = pseudonymize(row[col("ID")], hashSecret);
      if (!subjectKey) {
        err("ID", "利用者IDが空欄です");
        continue;
      }
      const staffKey = pseudonymize(row[col("主訪問者")], hashSecret);
      if (!staffKey) {
        err("主訪問者", "主訪問者が空欄です");
        continue;
      }
      const category = normalizeText(row[col("訪問種別")]);
      if (!IBOW_VISIT_CATEGORIES.map((c) => c.normalize("NFKC")).includes(category)) {
        err("訪問種別", `訪問種別の値「${category}」は確認済みの値（${IBOW_VISIT_CATEGORIES.join("・")}）ではありません`);
        continue;
      }
      const m = parseCount(row[col("提供時間")]);
      if (!m.ok) {
        err("提供時間", m.reason);
        continue;
      }
      if (m.value === null) missingMinutes++; // 空欄は時間不明として扱い、0分にしない
      const start = normalizeText(row[col("開始時間")]);
      visits.push({
        date: date.value,
        yearMonth: yearMonthOf(date.value),
        subjectKey,
        staffKey,
        category,
        minutes: m.value,
        dupKey: [formatDate(date.value), subjectKey, staffKey, category, start, m.value ?? ""].join("|"),
      });
    }
  }
  if (!found) {
    issues.push({ severity: "ERROR", code: "HEADER_NOT_FOUND", message: `見出し行（${IBOW_IMPL_HEADERS.join("・")}）が見つかりません` });
  }
  if (missingMinutes) {
    issues.push({ severity: "WARNING", code: "MISSING_MINUTES", message: `提供時間が空欄の訪問が ${missingMinutes} 件あります（件数には含め、時間は不明として扱います）` });
  }
  return { visits, issues, totalRows };
}
