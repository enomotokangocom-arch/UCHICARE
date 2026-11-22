import { GoalSheetSync } from "./types";
import { nowIsoLocal } from "./util";

/** スプレッドシートのURLまたはIDからファイルIDを取り出す */
export function parseSpreadsheetId(input: string): string {
  const t = input.trim();
  const m = t.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]+)/) ?? t.match(/[?&]id=([A-Za-z0-9_-]+)/);
  return m ? m[1] : t;
}

export function spreadsheetUrl(fileId: string): string {
  return `https://docs.google.com/spreadsheets/d/${fileId}/edit`;
}

/** CSV(ダブルクォート・セル内改行に対応)を2次元配列にする */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        cell += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += c;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

const normalize = (s: string) => s.replace(/[\s　]/g, "");

/** 「進捗管理ダッシュボード」の見出しの右隣のセルを読む */
const LABELS: Record<string, keyof Omit<GoalSheetSync, "syncedAt" | "selfProgress" | "mentorProgress"> | "selfProgress" | "mentorProgress"> = {
  氏名: "sheetStaffName",
  対象CDP段階: "cdpStage",
  "6か月自己": "self6",
  "6か月育成者": "mentor6",
  "1年後自己": "self1y",
  "1年後育成者": "mentor1y",
  自己進捗率: "selfProgress",
  育成進捗率: "mentorProgress",
  自己平均点: "selfAvg",
  育成平均点: "mentorAvg",
};

function parsePercent(v: string): number | null {
  const m = v.replace(/,/g, "").match(/(-?\d+(?:\.\d+)?)\s*%/);
  if (m) return Number(m[1]) / 100;
  const n = Number(v);
  return v.trim() !== "" && Number.isFinite(n) ? (n > 1 ? n / 100 : n) : null;
}

/** 目標管理シートの先頭シート(進捗管理ダッシュボード)のCSVから進捗を取り出す */
export function extractGoalSheetSync(csv: string): GoalSheetSync {
  const result: GoalSheetSync = {
    sheetStaffName: "",
    cdpStage: "",
    self6: "",
    mentor6: "",
    self1y: "",
    mentor1y: "",
    selfProgress: null,
    mentorProgress: null,
    selfAvg: "",
    mentorAvg: "",
    syncedAt: nowIsoLocal(),
  };
  let found = 0;
  for (const row of parseCsv(csv)) {
    row.forEach((cell, i) => {
      const key = LABELS[normalize(cell)];
      if (!key) return;
      const value = (row[i + 1] ?? "").trim();
      found++;
      if (key === "selfProgress" || key === "mentorProgress") result[key] = parsePercent(value);
      else result[key] = value;
    });
  }
  if (found === 0) {
    throw new Error("目標管理シートの「進捗管理ダッシュボード」が見つかりませんでした。原本をコピーしたシートか確認してください。");
  }
  return result;
}
