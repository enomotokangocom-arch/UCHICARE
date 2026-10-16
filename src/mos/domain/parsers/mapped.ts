// 列仕様が未確認のファイル（iBow 売上・iBow 訪問実績・ZEST）を、管理者が確定した列マッピングで読む。
// マッピングされていない列は読まない（＝保存しない）。ID 列はハッシュ化する。
import { createHash } from "node:crypto";
import type { Sheet } from "../grid";
import {
  formatDate,
  isBlank,
  normalizeText,
  parseAmount,
  parseCount,
  parseDate,
  parseYearMonth,
  yearMonthOf,
  type CalendarDate,
  type YearMonth,
} from "../normalize";
import { PURPOSE_FIELDS, type ColumnMappingSpec, type VisitStatusValue } from "../mappingFields";
import { isPiiHeader, pseudonymize } from "../privacy";
import type { BusinessUnit, Issue, JobType } from "../types";

export { METRIC_KEYS, PURPOSE_FIELDS, type ColumnMappingSpec, type FieldDef, type MappingPurpose, type VisitStatusValue } from "../mappingFields";

export type SheetHeaderInfo = {
  sheet: string;
  headerRowIndex: number;
  headers: string[];
  dataRows: number;
  nonEmpty: number[];
  piiColumns: number[];
};

/** 先頭から最初の「2列以上が埋まっている行」を見出し行とみなし、列名と非空件数だけを返す（値は返さない） */
export function extractHeaderInfo(sheets: Sheet[]): SheetHeaderInfo[] {
  const out: SheetHeaderInfo[] = [];
  for (const sheet of sheets) {
    const idx = sheet.rows.findIndex((r, i) => i < 30 && r.filter((c) => !isBlank(c)).length >= 2);
    if (idx < 0) continue;
    const headers = sheet.rows[idx].map((c) => normalizeText(c));
    const nonEmpty = headers.map(() => 0);
    let dataRows = 0;
    for (let r = idx + 1; r < sheet.rows.length; r++) {
      const row = sheet.rows[r];
      if (row.every((c) => isBlank(c))) continue;
      dataRows++;
      headers.forEach((_, c) => {
        if (!isBlank(row[c])) nonEmpty[c]++;
      });
    }
    out.push({
      sheet: sheet.name,
      headerRowIndex: idx,
      headers,
      dataRows,
      nonEmpty,
      piiColumns: headers.map((h, i) => (isPiiHeader(h) ? i : -1)).filter((i) => i >= 0),
    });
  }
  return out;
}

/** 列名集合のシグネチャ（同じ形式のファイルに同じマッピングを自動適用するため） */
export function headerSignature(info: SheetHeaderInfo[]): string {
  const parts = [...new Set(info.map((s) => s.headers.filter(Boolean).join("|")))].sort();
  return createHash("sha256").update(parts.join("\n")).digest("hex").slice(0, 32);
}

/** マッピングの妥当性検査（個人情報列の割当制限・必須項目） */
export function validateMapping(spec: ColumnMappingSpec, info: SheetHeaderInfo[]): string[] {
  const errors: string[] = [];
  const defs = PURPOSE_FIELDS[spec.purpose];
  const allHeaders = new Set(info.flatMap((s) => s.headers));
  const used = new Map<string, string>();
  for (const [header, key] of Object.entries(spec.fields)) {
    if (!key || key === "IGNORE") continue;
    if (!allHeaders.has(header)) errors.push(`列「${header}」はファイルにありません`);
    const def = defs.find((d) => d.key === key);
    if (!def) {
      errors.push(`項目「${key}」は取込目的に含まれません`);
      continue;
    }
    if (isPiiHeader(header) && !def.idField) {
      errors.push(`列「${header}」は個人情報を含むため、「取込まない」かID（ハッシュ化）にしか割り当てられません`);
    }
    if (used.has(key)) errors.push(`項目「${def.label}」に複数の列が割り当てられています`);
    used.set(key, header);
  }
  for (const d of defs.filter((d) => d.required)) {
    if (!used.has(d.key)) errors.push(`必須項目「${d.label}」が割り当てられていません`);
  }
  if (spec.purpose === "METRICS" && ![...used.keys()].some((k) => k.startsWith("metric:"))) {
    errors.push("指標の列が1つも割り当てられていません");
  }
  return errors;
}

export type MappedSalesRow = { yearMonth: YearMonth; unit: BusinessUnit; amount: number; quantity: number | null };
export type MappedVisitRow = {
  date: CalendarDate;
  yearMonth: YearMonth;
  unit: BusinessUnit;
  staffKey: string | null;
  jobType: JobType | null;
  subjectKey: string | null;
  minutes: number | null;
  status: VisitStatusValue | null;
  dupKey: string;
};
export type MappedMetricRow = { yearMonth: YearMonth; unit: BusinessUnit; metricKey: string; value: number };

export type MappedResult = {
  sales: MappedSalesRow[];
  visits: MappedVisitRow[];
  metrics: MappedMetricRow[];
  issues: Issue[];
  totalRows: number;
};

function lookup<T extends string>(map: Record<string, T> | undefined, raw: unknown): T | undefined {
  if (!map) return undefined;
  const key = normalizeText(raw);
  return map[key];
}

export function applyMapping(
  sheets: Sheet[],
  info: SheetHeaderInfo[],
  spec: ColumnMappingSpec,
  opts: { hashSecret: string; defaultUnit: BusinessUnit },
): MappedResult {
  const issues: Issue[] = [];
  const result: MappedResult = { sales: [], visits: [], metrics: [], issues, totalRows: 0 };
  for (const hi of info) {
    const sheet = sheets.find((s) => s.name === hi.sheet);
    if (!sheet) continue;
    const colOf = new Map<string, number>();
    for (const [header, key] of Object.entries(spec.fields)) {
      if (!key || key === "IGNORE") continue;
      const idx = hi.headers.indexOf(header);
      if (idx >= 0) colOf.set(key, idx);
    }
    // このシートに必須列が無ければ対象外（zip 内の別形式 CSV 等）
    const required = PURPOSE_FIELDS[spec.purpose].filter((d) => d.required).map((d) => d.key);
    if (!required.every((k) => colOf.has(k))) {
      issues.push({ severity: "INFO", code: "SHEET_SKIPPED", message: "マッピングの必須列が無いため対象外", sheet: sheet.name });
      continue;
    }
    for (let r = hi.headerRowIndex + 1; r < sheet.rows.length; r++) {
      const row = sheet.rows[r];
      if (row.every((c) => isBlank(c))) continue;
      result.totalRows++;
      const rowNumber = r + 1;
      const err = (column: string, message: string) =>
        issues.push({ severity: "ERROR", code: "INVALID_VALUE", message, sheet: sheet.name, rowNumber, column });
      const cell = (key: string) => (colOf.has(key) ? row[colOf.get(key)!] : undefined);

      let unit: BusinessUnit = opts.defaultUnit;
      if (colOf.has("unit")) {
        const u = lookup(spec.valueMaps.unit, cell("unit"));
        if (!u) {
          err("事業所", `事業所の値「${normalizeText(cell("unit"))}」が値の対応表にありません`);
          continue;
        }
        unit = u;
      }

      if (spec.purpose === "SALES") {
        const ymr = parseYearMonth(cell("yearMonth"));
        if (!ymr.ok) {
          err("対象年月", ymr.reason);
          continue;
        }
        const amount = parseAmount(cell("amount"));
        if (!amount.ok || amount.value === null) {
          err("売上金額", amount.ok ? "売上金額が空欄です" : amount.reason);
          continue;
        }
        let quantity: number | null = null;
        if (colOf.has("quantity")) {
          const q = parseCount(cell("quantity"));
          if (!q.ok) {
            err("件数", q.reason);
            continue;
          }
          quantity = q.value;
        }
        result.sales.push({ yearMonth: ymr.value, unit, amount: amount.value, quantity });
      } else if (spec.purpose === "VISITS") {
        const d = parseDate(cell("visitDate"));
        if (!d.ok) {
          err("訪問日", d.reason);
          continue;
        }
        let jobType: JobType | null = null;
        if (colOf.has("jobType") && !isBlank(cell("jobType"))) {
          const j = lookup(spec.valueMaps.jobType, cell("jobType"));
          if (!j) {
            err("職種", `職種の値が値の対応表にありません`);
            continue;
          }
          jobType = j;
        }
        let status: VisitStatusValue | null = null;
        if (colOf.has("status")) {
          const s = lookup(spec.valueMaps.status, cell("status"));
          if (!s) {
            err("状態", `状態の値「${normalizeText(cell("status"))}」が値の対応表にありません`);
            continue;
          }
          status = s;
        }
        let minutes: number | null = null;
        if (colOf.has("minutes") && !isBlank(cell("minutes"))) {
          const raw = normalizeText(cell("minutes")).replace(/分$/, "");
          const m = parseCount(raw);
          if (!m.ok) {
            err("提供時間", m.reason);
            continue;
          }
          minutes = m.value;
        }
        const staffKey = colOf.has("staffId") ? pseudonymize(cell("staffId"), opts.hashSecret) : null;
        const subjectKey = colOf.has("subjectId") ? pseudonymize(cell("subjectId"), opts.hashSecret) : null;
        result.visits.push({
          date: d.value,
          yearMonth: yearMonthOf(d.value),
          unit,
          staffKey,
          jobType,
          subjectKey,
          minutes,
          status,
          dupKey: [formatDate(d.value), unit, staffKey, subjectKey, jobType, minutes, status].join("|"),
        });
      } else {
        const ymr = parseYearMonth(cell("yearMonth"));
        if (!ymr.ok) {
          err("対象年月", ymr.reason);
          continue;
        }
        for (const [key, idx] of colOf) {
          if (!key.startsWith("metric:")) continue;
          const v = row[idx];
          if (isBlank(v)) continue; // 空欄は値なし（0 にしない）
          const n = typeof v === "number" ? v : Number(normalizeText(v).replace(/,/g, ""));
          if (!Number.isFinite(n)) {
            err(hi.headers[idx], `数値として解釈できません`);
            continue;
          }
          result.metrics.push({ yearMonth: ymr.value, unit, metricKey: key.slice("metric:".length), value: n });
        }
      }
    }
  }
  return result;
}

/** 同じ年月・事業所の売上行を合算する（iBow 売上は明細行の可能性があるため） */
export function aggregateSales(rows: MappedSalesRow[]): MappedSalesRow[] {
  const map = new Map<string, MappedSalesRow>();
  for (const r of rows) {
    const k = `${r.yearMonth}|${r.unit}`;
    const cur = map.get(k);
    if (!cur) map.set(k, { ...r });
    else {
      cur.amount += r.amount;
      cur.quantity = cur.quantity === null || r.quantity === null ? null : cur.quantity + r.quantity;
    }
  }
  return [...map.values()].sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
}
