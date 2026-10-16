// 銀行明細パーサ（GMOあおぞらネット銀行 / 仙台銀行）。列仕様は docs/mos/01-data-spec.md §1, §2。
import { findHeaderRow, type Sheet } from "../grid";
import { compactLabel, normalizeText, parseAmount, parseCount, parseDate, type CalendarDate } from "../normalize";
import type { Bank, Issue } from "../types";

export type ParsedBankTx = {
  bank: Bank;
  /** 口座識別子（そのまま DB には保存せず、ハッシュと末尾4桁に変換する） */
  accountIdentifier: string;
  accountLabel: string;
  date: CalendarDate;
  seq: number | null;
  description: string;
  memo: string | null;
  txType: string | null;
  counterpartyBank: string | null;
  deposit: number;
  withdrawal: number;
  balance: number | null;
  rowNumber: number;
  sheet: string;
};

export type BankParseResult = { transactions: ParsedBankTx[]; issues: Issue[]; totalRows: number };

export const GMO_HEADERS = ["日付", "摘要", "入金金額", "出金金額", "残高"];
export const SENDAI_HEADERS = ["照会口座", "番号", "勘定日", "出金金額（円）", "入金金額（円）", "残高（円）", "摘要"];

const headerKey = (v: unknown) => compactLabel(v);

function rowIsEmpty(row: unknown[]): boolean {
  return row.every((c) => c === null || c === undefined || normalizeText(c) === "");
}

type AmountPair = { deposit: number; withdrawal: number } | { error: string };

function amountPair(depositRaw: unknown, withdrawalRaw: unknown): AmountPair {
  const d = parseAmount(depositRaw);
  const w = parseAmount(withdrawalRaw);
  if (!d.ok) return { error: `入金金額: ${d.reason}` };
  if (!w.ok) return { error: `出金金額: ${w.reason}` };
  if (d.value === null && w.value === null) return { error: "入金金額・出金金額がどちらも空欄です" };
  if (d.value !== null && w.value !== null) return { error: "入金金額・出金金額の両方に値があります" };
  const deposit = d.value ?? 0;
  const withdrawal = w.value ?? 0;
  if (deposit < 0 || withdrawal < 0) return { error: "金額が負の値です" };
  if (deposit === 0 && withdrawal === 0) return { error: "金額が0円です" };
  return { deposit, withdrawal };
}

export function parseGmo(sheets: Sheet[]): BankParseResult {
  const issues: Issue[] = [];
  const transactions: ParsedBankTx[] = [];
  let totalRows = 0;
  let found = false;
  for (const sheet of sheets) {
    const header = findHeaderRow(sheet, GMO_HEADERS, headerKey);
    if (!header) continue;
    found = true;
    const col = (label: string) => header.columns.get(headerKey(label));
    const memoCol = col("メモ");
    // シート名 statement-<番号>-<番号>-<口座番号> を口座識別子として使う（単一口座の場合のみ）
    const sheetName = normalizeText(sheet.name);
    const accountIdentifier = /^statement-[\d-]+$/i.test(sheetName) ? sheetName : "GMO";
    if (accountIdentifier === "GMO") {
      issues.push({
        severity: "WARNING",
        code: "GMO_ACCOUNT_UNKNOWN",
        message: "シート名から口座を識別できないため、GMO の単一口座として扱います",
        sheet: sheet.name,
      });
    }
    for (let r = header.rowIndex + 1; r < sheet.rows.length; r++) {
      const row = sheet.rows[r];
      if (rowIsEmpty(row)) continue;
      totalRows++;
      const rowNumber = r + 1;
      const date = parseDate(row[col("日付")!]);
      if (!date.ok) {
        issues.push({ severity: "ERROR", code: "INVALID_DATE", message: date.reason, sheet: sheet.name, rowNumber, column: "日付" });
        continue;
      }
      const pair = amountPair(row[col("入金金額")!], row[col("出金金額")!]);
      if ("error" in pair) {
        issues.push({ severity: "ERROR", code: "INVALID_AMOUNT", message: pair.error, sheet: sheet.name, rowNumber });
        continue;
      }
      const balance = parseAmount(row[col("残高")!]);
      if (!balance.ok) {
        issues.push({ severity: "ERROR", code: "INVALID_AMOUNT", message: `残高: ${balance.reason}`, sheet: sheet.name, rowNumber, column: "残高" });
        continue;
      }
      const description = normalizeText(row[col("摘要")!]);
      if (!description) {
        issues.push({ severity: "ERROR", code: "MISSING_DESCRIPTION", message: "摘要が空欄です", sheet: sheet.name, rowNumber, column: "摘要" });
        continue;
      }
      const memo = memoCol !== undefined ? normalizeText(row[memoCol]) || null : null;
      transactions.push({
        bank: "GMO",
        accountIdentifier,
        accountLabel: "GMOあおぞらネット銀行",
        date: date.value,
        seq: null,
        description,
        memo,
        txType: null,
        counterpartyBank: null,
        deposit: pair.deposit,
        withdrawal: pair.withdrawal,
        balance: balance.value,
        rowNumber,
        sheet: sheet.name,
      });
    }
  }
  if (!found) {
    issues.push({ severity: "ERROR", code: "HEADER_NOT_FOUND", message: `見出し行（${GMO_HEADERS.join("・")}）が見つかりません` });
  }
  return { transactions, issues, totalRows };
}

/** 「〇〇支店（123） 普通 1234567」→ 表示名と末尾番号 */
export function describeSendaiAccount(raw: string): { label: string; number: string | null } {
  const s = normalizeText(raw);
  const m = s.match(/^(.*?)\s+(\d{4,})$/);
  if (!m) return { label: `仙台銀行 ${s}`, number: null };
  return { label: `仙台銀行 ${m[1]}`, number: m[2] };
}

export function parseSendai(sheets: Sheet[]): BankParseResult {
  const issues: Issue[] = [];
  const transactions: ParsedBankTx[] = [];
  let totalRows = 0;
  let found = false;
  for (const sheet of sheets) {
    const header = findHeaderRow(sheet, SENDAI_HEADERS, headerKey);
    if (!header) continue;
    found = true;
    const col = (label: string) => header.columns.get(headerKey(label))!;
    const descCol = col("摘要");
    // 摘要の右隣の見出し空欄列に手入力メモが入る（実ファイルで確認）
    const headerRow = sheet.rows[header.rowIndex];
    const memoCol = normalizeText(headerRow[descCol + 1]) === "" ? descCol + 1 : undefined;
    for (let r = header.rowIndex + 1; r < sheet.rows.length; r++) {
      const row = sheet.rows[r];
      if (rowIsEmpty(row)) continue;
      totalRows++;
      const rowNumber = r + 1;
      const accountRaw = normalizeText(row[col("照会口座")]);
      if (!accountRaw) {
        issues.push({ severity: "ERROR", code: "MISSING_ACCOUNT", message: "照会口座が空欄です", sheet: sheet.name, rowNumber, column: "照会口座" });
        continue;
      }
      const date = parseDate(row[col("勘定日")]);
      if (!date.ok) {
        issues.push({ severity: "ERROR", code: "INVALID_DATE", message: date.reason, sheet: sheet.name, rowNumber, column: "勘定日" });
        continue;
      }
      const seq = parseCount(row[col("番号")]);
      if (!seq.ok || seq.value === null) {
        issues.push({ severity: "ERROR", code: "INVALID_SEQ", message: "番号が不正です", sheet: sheet.name, rowNumber, column: "番号" });
        continue;
      }
      const pair = amountPair(row[col("入金金額（円）")], row[col("出金金額（円）")]);
      if ("error" in pair) {
        issues.push({ severity: "ERROR", code: "INVALID_AMOUNT", message: pair.error, sheet: sheet.name, rowNumber });
        continue;
      }
      const balance = parseAmount(row[col("残高（円）")]);
      if (!balance.ok) {
        issues.push({ severity: "ERROR", code: "INVALID_AMOUNT", message: `残高: ${balance.reason}`, sheet: sheet.name, rowNumber, column: "残高（円）" });
        continue;
      }
      const description = normalizeText(row[descCol]);
      const typeCol = header.columns.get(headerKey("取引区分"));
      const bankCol = header.columns.get(headerKey("金融機関名"));
      const txType = typeCol !== undefined ? normalizeText(row[typeCol]) || null : null;
      if (!description && !txType) {
        issues.push({ severity: "ERROR", code: "MISSING_DESCRIPTION", message: "摘要・取引区分がどちらも空欄です", sheet: sheet.name, rowNumber, column: "摘要" });
        continue;
      }
      const account = describeSendaiAccount(accountRaw);
      transactions.push({
        bank: "SENDAI",
        accountIdentifier: accountRaw,
        accountLabel: account.label,
        date: date.value,
        seq: seq.value,
        // 摘要が空欄の入金（実ファイルで確認）は取引区分を摘要として扱う
        description: description || `（摘要なし・${txType}）`,
        memo: memoCol !== undefined ? normalizeText(row[memoCol]) || null : null,
        txType,
        counterpartyBank: bankCol !== undefined ? normalizeText(row[bankCol]) || null : null,
        deposit: pair.deposit,
        withdrawal: pair.withdrawal,
        balance: balance.value,
        rowNumber,
        sheet: sheet.name,
      });
    }
  }
  if (!found) {
    issues.push({ severity: "ERROR", code: "HEADER_NOT_FOUND", message: `見出し行（${SENDAI_HEADERS.join("・")}）が見つかりません` });
  }
  return { transactions, issues, totalRows };
}
