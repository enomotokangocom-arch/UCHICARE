// 残高試算表（年間推移・部門別）パーサ。構造は docs/mos/01-data-spec.md §4。
// PDF から取り出した「ページごとの行テキスト」を入力とする（PDF→行の変換は pdfText.ts）。
import { monthColumnToYearMonth } from "../fiscal";
import { compactLabel, normalizeText, parseAmount, type YearMonth } from "../normalize";
import type { Issue, Unit } from "../types";

export type TbSegment = Exclude<Unit, "HQ">;

export const SEGMENT_LABELS: Record<string, TbSegment> = {
  "事業所(合計)": "COMPANY",
  訪問看護: "HOMONKANGO",
  居宅支援: "KYOTAKU",
};

export type TbParsedLine = {
  fiscalYear: number;
  segment: TbSegment;
  accountName: string;
  monthly: { yearMonth: YearMonth; amount: number }[];
  closing: number;
  total: number;
  page: number;
};

export type TbParseResult = {
  fiscalYear: number | null;
  lines: TbParsedLine[];
  /** 計上済みの月（いずれかの科目が0以外の月） */
  bookedMonths: YearMonth[];
  issues: Issue[];
  totalRows: number;
};

const NUM_TOKEN = /^[-△▲]?[\d,]+$/;

export function isTrialBalanceText(pages: string[][]): boolean {
  const all = compactLabel(pages.flat().join(" "));
  return all.includes("残高試算表") && all.includes("損益計算書");
}

function parseMonthHeader(tokens: string[]): { months: number[]; hasClosing: boolean; hasTotal: boolean } | null {
  const months: number[] = [];
  let hasClosing = false;
  let hasTotal = false;
  for (const t of tokens) {
    const m = t.match(/^(\d{1,2})月度$/);
    if (m) months.push(+m[1]);
    else if (t === "決算仕訳合計") hasClosing = true;
    else if (t === "当期合計") hasTotal = true;
  }
  if (months.length === 0) return null;
  return { months, hasClosing, hasTotal };
}

export function parseTrialBalancePages(pages: string[][]): TbParseResult {
  const issues: Issue[] = [];
  const lines: TbParsedLine[] = [];
  let fiscalYear: number | null = null;
  let totalRows = 0;

  pages.forEach((pageLines, pageIndex) => {
    const page = pageIndex + 1;
    const sheet = `${page}頁`;
    let segment: TbSegment | null = null;
    let header: { months: number[]; hasClosing: boolean; hasTotal: boolean } | null = null;
    let pageFy: number | null = null;

    for (const rawLine of pageLines) {
      const line = normalizeText(rawLine);
      if (!line) continue;
      const compact = compactLabel(line);

      if (compact.includes("残高試算表")) {
        const m = compact.match(/令和(元|\d{1,2})年度/);
        if (m) pageFy = 2018 + (m[1] === "元" ? 1 : +m[1]);
        continue;
      }
      if (SEGMENT_LABELS[compact]) {
        segment = SEGMENT_LABELS[compact];
        continue;
      }
      if (compact.startsWith("勘定科目")) {
        // 「勘 定 科 目」の後ろの列見出しだけを取り出す
        const tokens = line.split(" ").filter((t) => !"勘定科目".includes(t));
        header = parseMonthHeader(tokens.map((t) => compactLabel(t)));
        if (!header || !header.hasClosing || !header.hasTotal) {
          issues.push({ severity: "ERROR", code: "HEADER_INVALID", message: "列見出し（N月度・決算仕訳合計・当期合計）を解釈できません", sheet });
          header = null;
        }
        continue;
      }

      const tokens = line.split(" ");
      let firstNum = tokens.length;
      while (firstNum > 0 && NUM_TOKEN.test(tokens[firstNum - 1])) firstNum--;
      const numTokens = tokens.slice(firstNum);
      const label = compactLabel(tokens.slice(0, firstNum).join(""));
      if (numTokens.length === 0 || !label) continue; // 表題・作成者などの行

      if (!header || !segment || pageFy === null) {
        issues.push({ severity: "ERROR", code: "CONTEXT_MISSING", message: `年度・部門・列見出しが特定できない位置の行です（${label}）`, sheet });
        continue;
      }
      totalRows++;
      const expected = header.months.length + 2;
      if (numTokens.length !== expected) {
        issues.push({ severity: "ERROR", code: "COLUMN_COUNT", message: `「${label}」の数値の個数が ${numTokens.length} 個です（想定 ${expected} 個）`, sheet });
        continue;
      }
      const values: number[] = [];
      let bad = false;
      for (const t of numTokens) {
        const p = parseAmount(t);
        if (!p.ok || p.value === null) {
          bad = true;
          break;
        }
        values.push(p.value);
      }
      if (bad) {
        issues.push({ severity: "ERROR", code: "INVALID_AMOUNT", message: `「${label}」に金額として解釈できない値があります`, sheet });
        continue;
      }
      const monthly = header.months.map((m, i) => ({ yearMonth: monthColumnToYearMonth(pageFy!, m), amount: values[i] }));
      const closing = values[header.months.length];
      const total = values[header.months.length + 1];
      const sum = monthly.reduce((s, x) => s + x.amount, 0) + closing;
      if (sum !== total) {
        issues.push({ severity: "ERROR", code: "TOTAL_MISMATCH", message: `「${label}」の月別合計＋決算仕訳（${sum}）が当期合計（${total}）と一致しません`, sheet });
        continue;
      }
      if (lines.some((l) => l.segment === segment && l.accountName === label && l.fiscalYear === pageFy)) {
        issues.push({ severity: "ERROR", code: "DUPLICATE_ACCOUNT", message: `部門内で科目「${label}」が重複しています`, sheet });
        continue;
      }
      lines.push({ fiscalYear: pageFy, segment, accountName: label, monthly, closing, total, page });
    }
    if (pageFy !== null) {
      if (fiscalYear !== null && fiscalYear !== pageFy) {
        issues.push({ severity: "ERROR", code: "MIXED_FISCAL_YEAR", message: "複数の会計年度が含まれています", sheet });
      }
      fiscalYear = fiscalYear ?? pageFy;
    }
  });

  if (fiscalYear === null) {
    issues.push({ severity: "ERROR", code: "FISCAL_YEAR_NOT_FOUND", message: "会計年度（令和N年度）が見つかりません" });
  }

  // 全科目が0の月は未計上として扱い、保存しない（0円の実績にしない）
  const booked = new Set<string>();
  for (const l of lines) for (const m of l.monthly) if (m.amount !== 0) booked.add(m.yearMonth);
  const bookedMonths = [...booked].sort();
  return { fiscalYear, lines, bookedMonths, issues, totalRows };
}

/** 部門整合性: 全社 = 訪問看護 + 居宅支援（科目ごと・月ごと）の差異 */
export function segmentIntegrityDiffs(
  rows: { segment: TbSegment; accountName: string; yearMonth: string; amount: number }[],
): { yearMonth: string; accountName: string; company: number; units: number; diff: number }[] {
  const key = (ym: string, a: string) => `${ym}\u0000${a}`;
  const company = new Map<string, number>();
  const units = new Map<string, number>();
  for (const r of rows) {
    const k = key(r.yearMonth, r.accountName);
    if (r.segment === "COMPANY") company.set(k, (company.get(k) ?? 0) + r.amount);
    else units.set(k, (units.get(k) ?? 0) + r.amount);
  }
  const out: { yearMonth: string; accountName: string; company: number; units: number; diff: number }[] = [];
  for (const k of new Set([...company.keys(), ...units.keys()])) {
    const c = company.get(k) ?? 0;
    const u = units.get(k) ?? 0;
    if (c !== u) {
      const [yearMonth, accountName] = k.split("\u0000");
      out.push({ yearMonth, accountName, company: c, units: u, diff: c - u });
    }
  }
  return out.sort((a, b) => a.yearMonth.localeCompare(b.yearMonth) || a.accountName.localeCompare(b.accountName));
}
