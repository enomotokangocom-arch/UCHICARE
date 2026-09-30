import { DB } from "./db";
import { Actor } from "./core";
import { dashboard } from "./hires";
import { HIRE_STATUS_LABELS, HireStatus } from "../shared/labels";

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * 進捗一覧CSV。認証情報(参照先を含む)・発行IDは出力しません。
 * Excelで文字化けしないようBOM付きUTF-8で出力します。
 */
export function progressCsv(db: DB, actor: Actor): string {
  const { hires } = dashboard(db, actor);
  const header = [
    "氏名", "氏名ローマ字", "部門", "事業所", "職種", "入社日", "準備期限", "準備担当者", "代行担当者", "状態",
    "必須作業(完了/対象)", "必須完了率(%)", "任意作業(完了/対象)", "未着手", "進行中", "発行待ち", "確認待ち", "期限超過", "Appleメール(状態)",
  ];
  const lines = [header.map(csvCell).join(",")];
  for (const h of hires) {
    const p = h.progress as ReturnType<typeof import("./hires").computeProgress>;
    lines.push([
      h.name, h.name_romaji, h.department_name, h.office_name, h.job_type_name, h.start_date, h.prep_deadline,
      h.preparer_name, h.deputy_name, HIRE_STATUS_LABELS[h.status as HireStatus],
      `${p.required_done}/${p.required_total}`, p.required_rate, `${p.optional_done}/${p.optional_total}`,
      p.counts.todo, p.counts.doing, p.counts.waiting_issue, p.counts.waiting_check, p.overdue,
      h.apple_email ? `${h.apple_email}(${h.apple_status === "created" ? "作成済み" : "予約中"})` : "",
    ].map(csvCell).join(","));
  }
  return "﻿" + lines.join("\r\n") + "\r\n";
}
