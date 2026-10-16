// ZEST「dashboard-経営指標」zip パーサ。構造は docs/mos/01-data-spec.md §6（実ファイルで確認）。
// - zip 内の各 CSV を、ファイル名ではなく見出し行で識別する（ファイル名には連番や記号の置換が入るため）。
// - CSV に対象期間（年月）が含まれないため、年月はアップロード時に利用者が指定する。
//   「平日・休日比較」の日数合計がその月の日数と一致しない場合は取込まない。
// - 訪問件数・訪問時間は「職員の予定(サービスプラン・緊急)」ベース＝予定値。
import type { Sheet } from "../grid";
import { compactLabel, normalizeText, type YearMonth } from "../normalize";
import type { Issue } from "../types";

export type ZestMetric = { metricKey: string; value: number };
export type ZestResult = { metrics: ZestMetric[]; issues: Issue[]; totalRows: number };

type Single = { kind: "single"; header: string; key: string; label: string; valueCol?: number };
type Breakdown = { kind: "breakdown"; header: string[]; key: string; label: string; valueCol: number; percent?: boolean };

/** 見出し（空白除去後）→ 指標。1行目がこの見出しの CSV だけを読む */
export const ZEST_SINGLE: Single[] = [
  { kind: "single", header: "日別x職員の予定(サービスプラン・緊急)訪問件数_対象期間", key: "VISITS_PLANNED", label: "訪問件数（予定）" },
  { kind: "single", header: "日別x職員の予定(サービスプラン・緊急)訪問時間_対象期間", key: "VISIT_HOURS_PLANNED", label: "訪問時間（予定・時間）" },
  { kind: "single", header: "日別x訪問利用者(サービスプラン・緊急)利用者数_対象期間", key: "USERS", label: "利用者数" },
  { kind: "single", header: "日別x訪問利用者(サービスプラン・緊急)初回訪問利用者数_対象期間", key: "NEW_USERS", label: "新規利用者数" },
  { kind: "single", header: "日別x訪問利用者(サービスプラン・緊急)停止利用者数_対象期間", key: "ENDED_USERS", label: "終了利用者数" },
  { kind: "single", header: "日別x訪問利用者(サービスプラン・緊急)継続利用者数_対象期間", key: "CONTINUING_USERS", label: "継続利用者数" },
  { kind: "single", header: "日別x訪問利用者(サービスプラン・緊急)ターミナルケア利用者数_対象期間", key: "TERMINAL_USERS", label: "ターミナルケア利用者数" },
  { kind: "single", header: "キャンセル理由キャンセル数_対象期間", key: "CANCELLATIONS", label: "キャンセル件数" },
  { kind: "single", header: "職員職員数_対象期間", key: "STAFF_COUNT", label: "職員数" },
  { kind: "single", header: "日別x職員想定受入可能件数想定受入可能件数_対象期間", key: "OPEN_SLOTS", label: "想定空き枠数" },
  { kind: "single", header: "1件あたり移動時間(対象期間)", key: "TRAVEL_MIN_PER_VISIT", label: "1件あたり移動時間（分）" },
  // 常勤換算は1列目が結合キー（join_key）、2列目が値
  { kind: "single", header: "年間カレンダー常勤換算用結合Key", key: "FTE", label: "常勤換算（人）", valueCol: 1 },
];

export const ZEST_BREAKDOWN: Breakdown[] = [
  { kind: "breakdown", header: ["先頭職種", "稼働率"], key: "UTIL_JOB", label: "職種別稼働率", valueCol: 1, percent: true },
  { kind: "breakdown", header: ["チーム名", "稼働率"], key: "UTIL_TEAM", label: "チーム別稼働率", valueCol: 1, percent: true },
  { kind: "breakdown", header: ["キャンセル理由キャンセル理由", "キャンセル理由キャンセル数"], key: "CANCEL_REASON", label: "キャンセル理由別件数", valueCol: 1 },
  { kind: "breakdown", header: ["サービスカテゴリー名", "日別x職員の予定(サービスプラン・緊急)担当者予定件数"], key: "VISITS_PLANNED_BY_INSURANCE", label: "保険種類別 訪問件数（予定）", valueCol: 1 },
  { kind: "breakdown", header: ["サービスカテゴリー名", "日別x職員の予定(サービスプラン・緊急)担当者予定時間"], key: "HOURS_PLANNED_BY_INSURANCE", label: "保険種類別 訪問時間（予定）", valueCol: 1 },
];

export const ZEST_METRIC_LABEL: Record<string, string> = Object.fromEntries(
  [...ZEST_SINGLE, ...ZEST_BREAKDOWN].map((d) => [d.key, d.label]),
);

/** 日数の検算に使う CSV の見出し */
const DAY_CHECK_HEADER = ["平日/休日", "日数"];

function num(raw: unknown, percent = false): number | null {
  const s = normalizeText(raw).replace(/,/g, "");
  if (s === "") return null;
  const m = s.match(/^(-?\d+(?:\.\d+)?)(%?)$/);
  if (!m) return NaN;
  if (percent !== (m[2] === "%")) return NaN;
  return percent ? Number(m[1]) / 100 : Number(m[1]);
}

function daysInMonth(ym: YearMonth): number {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function isZestExport(sheets: Sheet[]): boolean {
  const headers = sheets.map((s) => compactLabel((s.rows[0] ?? [])[0]));
  return ZEST_SINGLE.some((d) => headers.includes(d.header) && d.key === "VISITS_PLANNED");
}

export function parseZest(sheets: Sheet[], yearMonth: YearMonth | null): ZestResult {
  const issues: Issue[] = [];
  const metrics: ZestMetric[] = [];
  let totalRows = 0;
  if (!yearMonth) {
    issues.push({ severity: "ERROR", code: "PERIOD_REQUIRED", message: "ZEST 経営指標の CSV には対象期間が含まれていません。アップロード時に対象年月を指定してください" });
    return { metrics, issues, totalRows };
  }

  // 日数の検算（対象期間の指定ミスを防ぐ）
  const dayCheck = sheets.find((s) => DAY_CHECK_HEADER.every((h, i) => compactLabel((s.rows[0] ?? [])[i]) === h));
  if (!dayCheck) {
    issues.push({ severity: "ERROR", code: "DAY_CHECK_MISSING", message: "「平日・休日比較」の CSV が無いため、対象期間を検算できません" });
    return { metrics, issues, totalRows };
  }
  const days = dayCheck.rows.slice(1).reduce((s, r) => s + (num(r[1]) ?? 0), 0);
  if (days !== daysInMonth(yearMonth)) {
    issues.push({
      severity: "ERROR",
      code: "PERIOD_MISMATCH",
      message: `ファイルの対象期間は ${days} 日間ですが、指定された ${yearMonth} は ${daysInMonth(yearMonth)} 日です。対象年月を確認してください`,
    });
    return { metrics, issues, totalRows };
  }

  const used = new Set<Sheet>([dayCheck]);
  for (const def of ZEST_SINGLE) {
    const sheet = sheets.find((s) => compactLabel((s.rows[0] ?? [])[0]) === def.header);
    if (!sheet) {
      issues.push({ severity: "WARNING", code: "METRIC_MISSING", message: `「${def.label}」の CSV がありません` });
      continue;
    }
    used.add(sheet);
    totalRows++;
    const v = num((sheet.rows[1] ?? [])[def.valueCol ?? 0]);
    if (v === null) continue; // 空欄は値なし
    if (Number.isNaN(v)) {
      issues.push({ severity: "ERROR", code: "INVALID_VALUE", message: `「${def.label}」の値を数値として解釈できません`, sheet: sheet.name, rowNumber: 2 });
      continue;
    }
    metrics.push({ metricKey: def.key, value: v });
  }
  for (const def of ZEST_BREAKDOWN) {
    const sheet = sheets.find((s) => def.header.every((h, i) => compactLabel((s.rows[0] ?? [])[i]) === h));
    if (!sheet) continue;
    used.add(sheet);
    for (let r = 1; r < sheet.rows.length; r++) {
      const label = normalizeText(sheet.rows[r][0]);
      if (!label) continue;
      totalRows++;
      const v = num(sheet.rows[r][def.valueCol], def.percent);
      if (v === null) continue;
      if (Number.isNaN(v)) {
        issues.push({ severity: "ERROR", code: "INVALID_VALUE", message: `「${def.label}」の「${label}」を数値として解釈できません`, sheet: sheet.name, rowNumber: r + 1 });
        continue;
      }
      metrics.push({ metricKey: `${def.key}:${label}`, value: v });
    }
  }
  for (const s of sheets) {
    if (!used.has(s)) issues.push({ severity: "INFO", code: "SHEET_SKIPPED", message: "管理会計で使わない指標のため取込対象外", sheet: s.name });
  }
  return { metrics, issues, totalRows };
}
