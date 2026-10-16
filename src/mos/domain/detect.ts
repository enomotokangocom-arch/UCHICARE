// ファイルの読み込みと種別の自動判別（内容優先・ファイル名は補助）。
import { unzipSync } from "fflate";
import { findHeaderRow, readCsv, readXlsx, type Sheet } from "./grid";
import { compactLabel, normalizeText } from "./normalize";
import { GMO_HEADERS, SENDAI_HEADERS } from "./parsers/bank";
import { isKyotakuWorkbook } from "./parsers/kyotaku";
import { isTrialBalanceText } from "./parsers/trialBalance";
import { pdfToPageLines } from "./pdfText";
import type { Issue, SourceType } from "./types";

export type LoadedFile =
  | { kind: "xlsx"; sheets: Sheet[] }
  | { kind: "csv"; sheets: Sheet[] }
  | { kind: "pdf"; pages: string[][] }
  | { kind: "zip"; sheets: Sheet[] }
  | { kind: "unsupported"; reason: string };

function isZip(b: Uint8Array) {
  return b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
}
function isPdf(b: Uint8Array) {
  return b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46;
}

/** zip 内のファイル名は UTF-8 フラグが無いと CP932 のことがあるため、可能ならデコードし直す */
function zipEntryName(name: string): string {
  if (/^[\x00-\x7f]*$/.test(name)) return name;
  if (![...name].every((c) => c.charCodeAt(0) <= 0xff)) return name;
  try {
    const bytes = Uint8Array.from(name, (c) => c.charCodeAt(0));
    return new TextDecoder("shift_jis", { fatal: true }).decode(bytes);
  } catch {
    // 元の名前を使う
  }
  return name;
}

export async function loadFile(fileName: string, data: Uint8Array): Promise<LoadedFile> {
  const lower = fileName.toLowerCase();
  if (isPdf(data)) return { kind: "pdf", pages: await pdfToPageLines(data) };
  if (isZip(data)) {
    let entries: Record<string, Uint8Array>;
    try {
      entries = unzipSync(data);
    } catch {
      return { kind: "unsupported", reason: "zip を展開できません" };
    }
    if ("[Content_Types].xml" in entries) {
      return { kind: "xlsx", sheets: await readXlsx(data) };
    }
    const sheets: Sheet[] = [];
    for (const [rawName, bytes] of Object.entries(entries)) {
      const name = zipEntryName(rawName);
      if (name.endsWith("/") || name.startsWith("__MACOSX")) continue;
      if (name.toLowerCase().endsWith(".csv")) sheets.push(readCsv(bytes, name));
    }
    if (sheets.length === 0) return { kind: "unsupported", reason: "zip 内に CSV がありません" };
    return { kind: "zip", sheets };
  }
  if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
    return { kind: "csv", sheets: [readCsv(data, normalizeText(fileName))] };
  }
  return { kind: "unsupported", reason: "対応していない形式です（xlsx / csv / pdf / zip に対応）" };
}

function bySheets(sheets: Sheet[]): SourceType | null {
  if (sheets.some((s) => findHeaderRow(s, SENDAI_HEADERS, compactLabel))) return "BANK_SENDAI";
  if (sheets.some((s) => findHeaderRow(s, GMO_HEADERS, compactLabel))) return "BANK_GMO";
  if (isKyotakuWorkbook(sheets)) return "KYOTAKU_SALES_XLSX";
  return null;
}

export function detectByFileName(fileName: string): SourceType | null {
  const n = compactLabel(fileName).toLowerCase();
  if (/^saleslist.*\.csv$/.test(n)) return "IBOW_SALES_CSV";
  if (/^implementation.*\.xlsx$/.test(n)) return "IBOW_IMPLEMENTATION_XLSX";
  if (n.endsWith(".zip") && (n.includes("経営指標") || n.startsWith("dashboard"))) return "ZEST_METRICS_ZIP";
  if (n.includes("gmo") && (n.endsWith(".xlsx") || n.endsWith(".csv"))) return "BANK_GMO";
  if (n.includes("仙台銀行") && (n.endsWith(".xlsx") || n.endsWith(".csv"))) return "BANK_SENDAI";
  if (n.includes("居宅売上") && n.endsWith(".xlsx")) return "KYOTAKU_SALES_XLSX";
  if (n.includes("試算表") && n.endsWith(".pdf")) return "TRIAL_BALANCE_PDF";
  return null;
}

export type Detection = { sourceType: SourceType; detectedBy: string; issues: Issue[] };

export function detectSourceType(fileName: string, loaded: LoadedFile): Detection {
  const issues: Issue[] = [];
  let byContent: SourceType | null = null;
  if (loaded.kind === "pdf") byContent = isTrialBalanceText(loaded.pages) ? "TRIAL_BALANCE_PDF" : null;
  else if (loaded.kind === "xlsx" || loaded.kind === "csv") byContent = bySheets(loaded.sheets);
  const byName = detectByFileName(fileName);

  if (byContent && byName && byContent !== byName) {
    issues.push({
      severity: "WARNING",
      code: "TYPE_NAME_MISMATCH",
      message: `ファイル名からは「${byName}」、内容からは「${byContent}」と判定されました。内容を優先します`,
    });
  }
  if (byContent) return { sourceType: byContent, detectedBy: byName === byContent ? "content+filename" : "content", issues };
  if (byName) {
    // 内容で確認できる種別なのに内容が一致しない場合は取込まない
    const contentCheckable: SourceType[] = ["BANK_GMO", "BANK_SENDAI", "KYOTAKU_SALES_XLSX", "TRIAL_BALANCE_PDF"];
    if (contentCheckable.includes(byName)) {
      issues.push({
        severity: "ERROR",
        code: "CONTENT_MISMATCH",
        message: "ファイル名から種別を推定しましたが、内容が確認済みの形式と一致しません",
      });
      return { sourceType: "UNKNOWN", detectedBy: "filename", issues };
    }
    return { sourceType: byName, detectedBy: "filename", issues };
  }
  issues.push({ severity: "ERROR", code: "TYPE_UNKNOWN", message: "ファイルの種別を判別できません" });
  return { sourceType: "UNKNOWN", detectedBy: "none", issues };
}

