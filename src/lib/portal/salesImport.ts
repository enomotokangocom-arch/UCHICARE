import { parseCsv } from "./goalSheet";
import { DailySale, PersonalSales, SalesImportMapping, SalesSource, Staff } from "./types";
import { newId, nowIsoLocal } from "./util";

/** CSVファイルを読み込む。UTF-8 で文字化けする場合は Shift_JIS(ZEST・iBow等の日本語CSVに多い)として読み直す */
export async function readCsvFile(file: File): Promise<string[][]> {
  const buf = await file.arrayBuffer();
  let text = new TextDecoder("utf-8").decode(buf);
  if (text.includes("�")) text = new TextDecoder("shift_jis").decode(buf);
  text = text.replace(/^﻿/, "");
  return parseCsv(text).filter((r) => r.some((c) => c.trim() !== ""));
}

/** 見出し行を探す(先頭の数行のうち、空でないセルが最も多い行) */
export function findHeaderRow(rows: string[][]): number {
  let best = 0;
  let bestCount = -1;
  rows.slice(0, 10).forEach((r, i) => {
    const count = r.filter((c) => c.trim() !== "" && Number.isNaN(Number(c.replace(/[,¥円]/g, "")))).length;
    if (count > bestCount) {
      best = i;
      bestCount = count;
    }
  });
  return best;
}

const GUESS: Record<"dateCol" | "staffCol" | "amountCol" | "visitsCol", RegExp> = {
  dateCol: /(サービス提供日|提供日|訪問日|実施日|日付|年月日|日時)/,
  staffCol: /(担当者|担当|スタッフ|職員|訪問者|従事者|氏名|名前)/,
  amountCol: /(売上|金額|請求額|合計|費用|単位数|単位)/,
  visitsCol: /(件数|回数|訪問回数)/,
};

/** 見出しから列を推測する(利用者名の列は担当者と間違えないよう除外) */
export function guessMapping(headers: string[], prev?: SalesImportMapping): SalesImportMapping {
  const pick = (key: keyof typeof GUESS) => {
    if (prev?.[key] && headers.includes(prev[key])) return prev[key];
    const h = headers.find((x) => GUESS[key].test(x) && !(key === "staffCol" && /利用者|患者|被保険者/.test(x)));
    return h ?? "";
  };
  return {
    dateCol: pick("dateCol"),
    staffCol: pick("staffCol"),
    amountCol: pick("amountCol"),
    visitsCol: pick("visitsCol"),
    unitPrice: prev?.unitPrice ?? 1,
    staffAliases: prev?.staffAliases ?? {},
  };
}

/** いろいろな日付表記を YYYY-MM-DD にする(年がなければ今年) */
export function parseDate(v: string, today = new Date()): string | null {
  const t = v.trim().replace(/[年月]/g, "/").replace(/日.*$/, "").replace(/\s.*$/, "").replace(/-/g, "/");
  let m = t.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = t.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (m) return `${today.getFullYear()}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  return null;
}

export function parseAmount(v: string): number | null {
  const t = v.replace(/[,¥￥円\s]/g, "").replace(/^\((.*)\)$/, "-$1");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** 全角英数字・全角スペースの違いを無視して比べる */
/** 旧字体・異体字(髙→高 など)。iBow・ZEST と職員マスタで表記が違っても同じ人と見なす */
const VARIANTS: Record<string, string> = {
  髙: "高", 﨑: "崎", 嵜: "崎", 濵: "浜", 濱: "浜", 邊: "辺", 邉: "辺", 齋: "斎", 齊: "斉", 德: "徳", 櫻: "桜", 澤: "沢", 廣: "広", 國: "国", 槇: "槙", 冨: "富", 籐: "藤", 曾: "曽", 惠: "恵", 眞: "真", 實: "実", 舘: "館",
};

/** 氏名の比較用: 全角/半角・空白(全角スペース含む)・異体字の違いを無視する */
export function normName(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[\s\u3000]/g, "")
    .replace(/[\u{E0100}-\u{E01EF}\uFE00-\uFE0F]/gu, "")
    .replace(/./gu, (c) => VARIANTS[c] ?? c);
}

/**
 * ファイル上の氏名を職員に結びつける。
 * - 以前に結びつけた設定(aliases)が、削除済み・無効な職員を指していれば使わない
 * - 同じ氏名の職員が複数いれば、有効(使用中)の職員を優先する
 */
export function matchStaff(rawName: string, staff: Staff[], aliases: Record<string, string>): string {
  const alias = aliases[rawName];
  if (alias && staff.some((s) => s.id === alias && s.active)) return alias;
  const n = normName(rawName);
  const same = staff.filter((s) => normName(s.name) === n);
  return (same.find((s) => s.active) ?? same[0])?.id ?? "";
}

/** 同じ氏名(表記ゆれを含む)で、有効な職員が複数登録されている名前 */
export function duplicateStaffNames(staff: Staff[]): string[] {
  const count = new Map<string, { name: string; n: number }>();
  for (const s of staff.filter((x) => x.active)) {
    const k = normName(s.name);
    const c = count.get(k) ?? { name: s.name, n: 0 };
    c.n++;
    count.set(k, c);
  }
  return [...count.values()].filter((c) => c.n > 1).map((c) => c.name);
}

export interface ImportPreview {
  records: Omit<DailySale, "id" | "importedAt">[];
  skipped: number;
  rawNames: string[];
  unmatchedNames: string[];
  dates: string[];
  total: number;
}

/** 取り込み内容を、日付×職員ごとに集計する */
export function buildPreview(rows: string[][], headerIndex: number, mapping: SalesImportMapping, staff: Staff[], source: SalesSource): ImportPreview {
  const headers = rows[headerIndex] ?? [];
  const col = (name: string) => headers.indexOf(name);
  const di = col(mapping.dateCol);
  const si = col(mapping.staffCol);
  const ai = col(mapping.amountCol);
  const vi = mapping.visitsCol ? col(mapping.visitsCol) : -1;
  const agg = new Map<string, Omit<DailySale, "id" | "importedAt">>();
  const rawNames = new Set<string>();
  let skipped = 0;
  for (const r of rows.slice(headerIndex + 1)) {
    const date = di >= 0 ? parseDate(r[di] ?? "") : null;
    const amountRaw = ai >= 0 ? parseAmount(r[ai] ?? "") : null;
    if (!date || amountRaw === null) {
      skipped++;
      continue;
    }
    const rawName = si >= 0 ? (r[si] ?? "").trim() : "";
    if (rawName) rawNames.add(rawName);
    const staffId = rawName ? matchStaff(rawName, staff, mapping.staffAliases) : "";
    const visits = vi >= 0 ? parseAmount(r[vi] ?? "") ?? 0 : 1;
    const key = `${date}|${staffId || `?${rawName}`}`;
    const cur = agg.get(key) ?? { date, staffId, rawName, amount: 0, visits: 0, source };
    cur.amount += Math.round(amountRaw * (mapping.unitPrice || 1));
    cur.visits += visits;
    agg.set(key, cur);
  }
  const records = [...agg.values()].sort((a, b) => a.date.localeCompare(b.date));
  const names = [...rawNames];
  return {
    records,
    skipped,
    rawNames: names,
    unmatchedNames: names.filter((n) => !matchStaff(n, staff, mapping.staffAliases)),
    dates: [...new Set(records.map((r) => r.date))].sort(),
    total: records.reduce((s, r) => s + r.amount, 0),
  };
}

/** 取り込み: 同じ取り込み元・同じ日付の既存データは置き換える(二重計上を防ぐ) */
export function mergeDailySales(existing: DailySale[], preview: ImportPreview, source: SalesSource): DailySale[] {
  const dates = new Set(preview.dates);
  const kept = existing.filter((d) => !(d.source === source && dates.has(d.date)));
  const at = nowIsoLocal();
  return [...kept, ...preview.records.map((r) => ({ ...r, id: newId("ds"), importedAt: at }))];
}

/** 日次売上から、該当する月の個人の売上・訪問件数を計算し直す(目標はそのまま) */
export function recomputePersonalSales(personal: PersonalSales[], daily: DailySale[], months: string[]): PersonalSales[] {
  const result = [...personal];
  const monthSet = new Set(months);
  const totals = new Map<string, { revenue: number; visits: number; days: Set<string>; last: string }>();
  for (const d of daily) {
    const month = d.date.slice(0, 7);
    if (!d.staffId || !monthSet.has(month)) continue;
    const key = `${d.staffId}|${month}`;
    const t = totals.get(key) ?? { revenue: 0, visits: 0, days: new Set<string>(), last: "" };
    t.revenue += d.amount;
    t.visits += d.visits;
    // 稼働日数 = 実績のあった日の数
    if (d.amount || d.visits) t.days.add(d.date);
    if (d.date > t.last) t.last = d.date;
    totals.set(key, t);
  }
  for (const [key, t] of totals) {
    const [staffId, month] = key.split("|");
    const i = result.findIndex((p) => p.staffId === staffId && p.month === month);
    const end = new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate();
    const work = { workDays: t.days.size || null, periodEnd: Number(t.last.slice(8)) < end ? t.last : "" };
    if (i >= 0) result[i] = { ...result[i], revenue: t.revenue, visits: t.visits, ...work };
    else {
      // 新しい月は、直近の月の目標を引き継ぐ
      const prevTarget =
        result
          .filter((p) => p.staffId === staffId && p.month < month && p.target !== null)
          .sort((a, b) => b.month.localeCompare(a.month))[0]?.target ?? null;
      result.push({ id: newId("ps"), staffId, month, revenue: t.revenue, target: prevTarget, visits: t.visits, ...work });
    }
  }
  return result;
}
