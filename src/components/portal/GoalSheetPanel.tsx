"use client";

import { useState } from "react";
import { usePortalStore } from "@/lib/portal/store";
import { currentFiscalYear } from "@/lib/portal/defaults";
import { extractGoalSheetSync, parseSpreadsheetId, spreadsheetUrl } from "@/lib/portal/goalSheet";
import { copyFile, ensureFolderPath, exportSpreadsheetCsv, getItem } from "@/lib/portal/googleDrive";
import { GoalSheet, Staff } from "@/lib/portal/types";
import { formatDateTime, newId } from "@/lib/portal/util";
import { DriveConnect } from "./DriveConnect";
import { useDrive } from "./useDrive";
import { Card, ProgressBar, StatusPill, buttonClass, inputClass } from "./ui";

const GOAL_SHEET_FOLDER = ["人事評価", "目標管理シート"];

export function useGoalSheet(staffId: string | undefined, fy = currentFiscalYear()) {
  const sheets = usePortalStore((s) => s.goalSheets);
  return sheets.find((g) => g.staffId === staffId && g.fiscalYear === fy);
}

/** シートを読み込んで進捗を保存する */
export async function syncGoalSheet(sheet: GoalSheet, update: (id: string, patch: Partial<GoalSheet>) => void) {
  const csv = await exportSpreadsheetCsv(sheet.fileId);
  update(sheet.id, { sync: extractGoalSheetSync(csv) });
}

function statusTone(v: string): "ok" | "warn" | "neutral" {
  if (/済|完了|✅/.test(v)) return "ok";
  if (/未|⏳/.test(v)) return "warn";
  return "neutral";
}

export function GoalSheetSummary({ sheet, compact }: { sheet: GoalSheet; compact?: boolean }) {
  const s = sheet.sync;
  if (!s) return <p className="text-xs text-slate-400">まだ進捗を読み込んでいません。</p>;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700 ring-1 ring-brand-200">{s.cdpStage || "CDP段階 -"}</span>
        {!compact && s.sheetStaffName && <span className="text-xs text-slate-500">シートの氏名: {s.sheetStaffName}</span>}
      </div>
      <div className="grid grid-cols-1 gap-1.5 text-xs text-slate-600 sm:grid-cols-2">
        <div className="flex items-center gap-2">
          <span className="w-16 shrink-0">自己評価</span>
          <ProgressBar ratio={s.selfProgress} className="flex-1" />
        </div>
        <div className="flex items-center gap-2">
          <span className="w-16 shrink-0">育成者評価</span>
          <ProgressBar ratio={s.mentorProgress} className="flex-1" />
        </div>
      </div>
      {!compact && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["6か月 自己", s.self6],
                ["6か月 育成者", s.mentor6],
                ["1年後 自己", s.self1y],
                ["1年後 育成者", s.mentor1y],
              ] as const
            ).map(([label, v]) => (
              <StatusPill key={label} tone={statusTone(v)}>
                {label}: {v || "-"}
              </StatusPill>
            ))}
          </div>
          <p className="text-[11px] text-slate-500">
            平均点 自己 {s.selfAvg || "-"} / 育成者 {s.mentorAvg || "-"} ・ 読み込み {formatDateTime(s.syncedAt)}
          </p>
        </>
      )}
    </div>
  );
}

/** 職員1人分の目標管理シート(原本からの作成・登録・進捗の読み込み) */
export function GoalSheetPanel({ target, canEdit }: { target: Staff; canEdit: boolean }) {
  const templates = usePortalStore((s) => s.goalSheetTemplates);
  const collection = usePortalStore((s) => s.collection);
  const drive = useDrive();
  const fy = currentFiscalYear();
  const sheet = useGoalSheet(target.id, fy);
  const template = templates[target.unitId];
  const [urlInput, setUrlInput] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const update = (id: string, patch: Partial<GoalSheet>) => collection("goalSheets").update(id, patch);

  async function run(label: string, fn: () => Promise<string | void>) {
    setBusy(label);
    setMessage(null);
    try {
      const m = await fn();
      if (m) setMessage(m);
    } catch (e) {
      setMessage(`⚠ ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  }

  async function createFromTemplate() {
    if (!template) return;
    const folderId = await ensureFolderPath(drive.rootId, [...GOAL_SHEET_FOLDER, `${fy}年度`]);
    const name = `${fy}年度目標管理シート_${target.name}`;
    const file = await copyFile(parseSpreadsheetId(template), name, folderId);
    const created: GoalSheet = { id: newId("gs"), staffId: target.id, fiscalYear: fy, fileId: file.id, url: file.webViewLink || spreadsheetUrl(file.id), name: file.name };
    collection("goalSheets").add(created);
    await syncGoalSheet(created, update).catch(() => undefined);
    return `原本から「${file.name}」を作成しました。`;
  }

  async function register() {
    const fileId = parseSpreadsheetId(urlInput);
    const item = await getItem(fileId);
    if (!item.mimeType.includes("spreadsheet")) throw new Error("Googleスプレッドシートではありません。");
    const created: GoalSheet = { id: newId("gs"), staffId: target.id, fiscalYear: fy, fileId, url: item.webViewLink || spreadsheetUrl(fileId), name: item.name };
    collection("goalSheets").add(created);
    await syncGoalSheet(created, update);
    setUrlInput("");
    return `「${item.name}」を登録し、進捗を読み込みました。`;
  }

  return (
    <Card className="mb-4 border-gold-300">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-slate-900">📄 目標管理シート({fy}年度・キャリアラダー)</h2>
          <p className="mt-0.5 text-[11px] text-slate-500">原本のGoogleスプレッドシートをもとに、職員ごとのシートで目標と評価を管理します。</p>
        </div>
        {template && (
          <a href={template} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-brand-700 hover:underline">
            原本を開く ↗
          </a>
        )}
      </div>

      <div className="mt-3">
        {sheet ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <a href={sheet.url} target="_blank" rel="noopener noreferrer" className={buttonClass.primary}>
                📄 {target.name} さんのシートを開く
              </a>
              <button
                type="button"
                className={buttonClass.secondary}
                disabled={!drive.connected || !!busy}
                onClick={() => run("シートを読み込んでいます...", () => syncGoalSheet(sheet, update).then(() => "最新の進捗を読み込みました。"))}
              >
                ↻ 最新の進捗を読み込む
              </button>
              {canEdit && (
                <button
                  type="button"
                  className={buttonClass.ghost}
                  onClick={() => confirm("このシートの登録を解除しますか?(Googleドライブのシートは残ります)") && collection("goalSheets").remove(sheet.id)}
                >
                  登録を解除
                </button>
              )}
            </div>
            <GoalSheetSummary sheet={sheet} />
          </div>
        ) : !template ? (
          <p className="text-sm text-slate-400">この事業所の目標管理シートの原本はまだ設定されていません。</p>
        ) : !canEdit ? (
          <p className="text-sm text-slate-400">{target.name} さんのシートはまだ作成されていません(本人・管理者・統括部長が作成できます)。</p>
        ) : (
          <div className="space-y-3">
            {drive.ready ? (
              <button type="button" className={buttonClass.primary} disabled={!!busy} onClick={() => run("原本をコピーしています...", createFromTemplate)}>
                ＋ 原本から {target.name} さんのシートを作成
              </button>
            ) : (
              <DriveConnect />
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                className={inputClass}
                placeholder="すでにあるシートのURLを登録(https://docs.google.com/spreadsheets/d/...)"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
              />
              <button
                type="button"
                className={`${buttonClass.secondary} whitespace-nowrap`}
                disabled={!drive.connected || !urlInput.trim() || !!busy}
                onClick={() => run("シートを確認しています...", register)}
              >
                登録する
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              作成したシートはGoogleドライブの「人事評価/目標管理シート/{fy}年度」フォルダに保存されます。記入はGoogleスプレッドシートで行い、アプリでは進捗を読み込んで表示します。
            </p>
          </div>
        )}
      </div>
      {!drive.connected && sheet && <p className="mt-2 text-[11px] text-slate-400">進捗を読み込むにはGoogleドライブへの接続が必要です(「書類フォルダ」画面から接続)。</p>}
      {busy && <p className="mt-2 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-700">⏳ {busy}</p>}
      {message && (
        <p className={`mt-2 rounded-lg px-3 py-2 text-xs ${message.startsWith("⚠") ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>{message}</p>
      )}
    </Card>
  );
}

/** 経営者・統括部長・管理者向け: 職員のシートの進捗一覧と一括読み込み */
export function GoalSheetOverview({ staff }: { staff: Staff[] }) {
  const sheets = usePortalStore((s) => s.goalSheets);
  const collection = usePortalStore((s) => s.collection);
  const drive = useDrive();
  const fy = currentFiscalYear();
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const rows = staff.map((s) => ({ s, sheet: sheets.find((g) => g.staffId === s.id && g.fiscalYear === fy) }));

  async function syncAll() {
    setErrors([]);
    const errs: string[] = [];
    const targets = rows.filter((r) => r.sheet);
    for (const [i, r] of targets.entries()) {
      setBusy(`読み込み中 ${i + 1}/${targets.length}: ${r.s.name}`);
      try {
        await syncGoalSheet(r.sheet!, (id, patch) => collection("goalSheets").update(id, patch));
      } catch (e) {
        errs.push(`${r.s.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    setErrors(errs);
    setBusy(null);
  }

  return (
    <Card className="mt-6 p-0 sm:p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
        <h2 className="text-sm font-bold text-slate-900">職員の目標管理シート({fy}年度)</h2>
        <button type="button" className={buttonClass.secondary} disabled={!drive.connected || !!busy} onClick={syncAll}>
          ↻ まとめて最新の進捗を読み込む
        </button>
      </div>
      {busy && <p className="mx-4 mt-2 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-700">⏳ {busy}</p>}
      {errors.length > 0 && (
        <ul className="mx-4 mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {errors.map((e) => (
            <li key={e}>⚠ {e}</li>
          ))}
        </ul>
      )}
      <div className="overflow-x-auto p-2">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs text-slate-500">
            <tr>
              {["氏名", "CDP段階", "自己評価", "育成者評価", "読み込み日時", ""].map((h) => (
                <th key={h} className="px-2 py-1.5 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(({ s, sheet }) => (
              <tr key={s.id}>
                <td className="px-2 py-2 font-medium">{s.name}</td>
                <td className="px-2 py-2 text-xs">{sheet?.sync?.cdpStage || "-"}</td>
                <td className="w-40 px-2 py-2">{sheet?.sync ? <ProgressBar ratio={sheet.sync.selfProgress} /> : <span className="text-xs text-slate-400">-</span>}</td>
                <td className="w-40 px-2 py-2">{sheet?.sync ? <ProgressBar ratio={sheet.sync.mentorProgress} /> : <span className="text-xs text-slate-400">-</span>}</td>
                <td className="px-2 py-2 text-xs text-slate-500">{sheet?.sync ? formatDateTime(sheet.sync.syncedAt) : sheet ? "未読み込み" : "シート未作成"}</td>
                <td className="px-2 py-2 text-right">
                  {sheet && (
                    <a href={sheet.url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-brand-700 hover:underline">
                      開く ↗
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
