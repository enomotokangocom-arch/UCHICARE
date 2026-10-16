// iBow 月次売上（SalesList.csv）パーサ。構造は docs/mos/01-data-spec.md §7（2026年9月分の実ファイルで確認）。
// - Shift_JIS。1行目「ステーション名：…」、2行目「提供月：YYYY年MM月度」、3行目が見出し、以降1行＝利用者1人、最終行が合計行（利用者ID空欄）。
// - 保険種類ごとの「総金額」を合算して月次売上とし、合計行と検算する。
// - 利用者ID・公費番号（医療情報）・給付割合は保存しない。
import { findHeaderRow, type Sheet } from "../grid";
import { compactLabel, isBlank, parseAmount, parseCount, parseYearMonth, type YearMonth } from "../normalize";
import type { Issue } from "../types";

/** 保険種類 → 金額・回数・自己負担額の列 */
export const IBOW_SALES_KINDS = [
  { key: "medical", label: "医療", amount: "医療総金額", count: "医療提供回数", selfPay: "医療自己負担額" },
  { key: "care", label: "介護", amount: "介護総金額", count: "介護提供回数", selfPay: "介護自己負担額" },
  { key: "preventive", label: "予防", amount: "予防総金額", count: "予防提供回数", selfPay: "予防自己負担額" },
  { key: "regular", label: "定期巡回", amount: "定期巡回総金額", count: "定期巡回提供回数", selfPay: "定期巡回自己負担額" },
] as const;

export const IBOW_SALES_HEADERS = ["利用者ID", ...IBOW_SALES_KINDS.flatMap((k) => [k.amount, k.count, k.selfPay])];

export type IbowSalesKind = { amount: number; visits: number; selfPay: number; users: number };
export type IbowSalesMonth = {
  yearMonth: YearMonth;
  totalAmount: number;
  users: number;
  byKind: Record<(typeof IBOW_SALES_KINDS)[number]["key"], IbowSalesKind>;
};

export type IbowSalesResult = { month: IbowSalesMonth | null; issues: Issue[]; totalRows: number };

const key = (v: unknown) => compactLabel(v);

export function isIbowSales(sheets: Sheet[]): boolean {
  return sheets.some((s) => findHeaderRow(s, IBOW_SALES_HEADERS, key) !== null);
}

export function parseIbowSales(sheets: Sheet[]): IbowSalesResult {
  const issues: Issue[] = [];
  const sheet = sheets.find((s) => findHeaderRow(s, IBOW_SALES_HEADERS, key));
  if (!sheet) {
    return { month: null, issues: [{ severity: "ERROR", code: "HEADER_NOT_FOUND", message: `見出し行（${IBOW_SALES_HEADERS.slice(0, 4).join("・")}…）が見つかりません` }], totalRows: 0 };
  }
  const header = findHeaderRow(sheet, IBOW_SALES_HEADERS, key)!;
  const col = (h: string) => header.columns.get(key(h))!;

  // 提供月（見出しより上の「提供月：YYYY年MM月度」）
  let yearMonth: YearMonth | null = null;
  for (let r = 0; r < header.rowIndex; r++) {
    const text = compactLabel(sheet.rows[r]?.[0]);
    const m = text.match(/^提供月[:：](.+?)度?$/);
    if (m) {
      const ym = parseYearMonth(m[1]);
      if (ym.ok) yearMonth = ym.value;
    }
  }
  if (!yearMonth) {
    return { month: null, issues: [{ severity: "ERROR", code: "PERIOD_NOT_FOUND", message: "「提供月：YYYY年MM月度」の行が見つからないため取込めません" }], totalRows: 0 };
  }

  const blank = (): IbowSalesKind => ({ amount: 0, visits: 0, selfPay: 0, users: 0 });
  const sum: IbowSalesMonth["byKind"] = { medical: blank(), care: blank(), preventive: blank(), regular: blank() };
  let totalsRow: number[] | null = null;
  let users = 0;
  let totalRows = 0;
  let bad = false;
  for (let r = header.rowIndex + 1; r < sheet.rows.length; r++) {
    const row = sheet.rows[r];
    if (row.every((c) => isBlank(c))) continue;
    const rowNumber = r + 1;
    const isTotal = isBlank(row[col("利用者ID")]);
    const values: number[] = [];
    for (const k of IBOW_SALES_KINDS) {
      for (const [h, parse] of [[k.amount, parseAmount], [k.count, parseCount], [k.selfPay, parseAmount]] as const) {
        const v = parse(row[col(h)]);
        if (!v.ok) {
          issues.push({ severity: "ERROR", code: "INVALID_VALUE", message: `${h}: ${v.reason}`, sheet: sheet.name, rowNumber, column: h });
          bad = true;
          values.push(0);
        } else values.push(v.value ?? 0); // この表では空欄＝その保険の利用なし
      }
    }
    if (isTotal) {
      if (totalsRow) issues.push({ severity: "ERROR", code: "MULTIPLE_TOTALS", message: "合計行（利用者ID空欄）が複数あります", sheet: sheet.name, rowNumber });
      totalsRow = values;
      continue;
    }
    totalRows++;
    let used = false;
    IBOW_SALES_KINDS.forEach((k, i) => {
      const [amount, visits, selfPay] = values.slice(i * 3, i * 3 + 3);
      sum[k.key].amount += amount;
      sum[k.key].visits += visits;
      sum[k.key].selfPay += selfPay;
      if (amount || visits) {
        sum[k.key].users++;
        used = true;
      }
    });
    if (used) users++;
  }
  // 確認したファイルでは全行0。値がある場合の総金額との関係は未確認のため、売上には加えず警告する
  const cancerCol = header.columns.get(key("在宅がん医療総合診療料金額"));
  if (cancerCol !== undefined) {
    const nonZero = sheet.rows.slice(header.rowIndex + 1).some((row) => {
      const v = parseAmount(row[cancerCol]);
      return v.ok && v.value !== null && v.value !== 0;
    });
    if (nonZero) {
      issues.push({ severity: "WARNING", code: "UNCONFIRMED_COLUMN", message: "「在宅がん医療総合診療料金額」に値があります。総金額との関係が未確認のため、売上には加えていません" });
    }
  }
  if (bad) return { month: null, issues, totalRows };
  if (!totalsRow) {
    issues.push({ severity: "ERROR", code: "TOTAL_NOT_FOUND", message: "合計行（最終行・利用者ID空欄）が見つからないため検算できません" });
    return { month: null, issues, totalRows };
  }
  // 合計行と検算
  let mismatch = false;
  IBOW_SALES_KINDS.forEach((k, i) => {
    const [amount, visits, selfPay] = totalsRow!.slice(i * 3, i * 3 + 3);
    const s = sum[k.key];
    if (s.amount !== amount || s.visits !== visits || s.selfPay !== selfPay) {
      issues.push({
        severity: "ERROR",
        code: "TOTAL_MISMATCH",
        message: `${k.label}: 明細の合計（金額${s.amount}・回数${s.visits}・自己負担${s.selfPay}）が合計行（${amount}・${visits}・${selfPay}）と一致しません`,
        sheet: sheet.name,
      });
      mismatch = true;
    }
  });
  if (mismatch) return { month: null, issues, totalRows };
  const totalAmount = IBOW_SALES_KINDS.reduce((s, k) => s + sum[k.key].amount, 0);
  return { month: { yearMonth, totalAmount, users, byKind: sum }, issues, totalRows };
}

