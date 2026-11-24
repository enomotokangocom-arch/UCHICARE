"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/portal/auth";
import { usePortalStore } from "@/lib/portal/store";
import { uploadLocalToServer, useSync } from "@/lib/portal/sync";
import { buttonClass } from "@/components/portal/ui";

interface AuditRow {
  id: number;
  at: string;
  actor_staff: string | null;
  action: string;
  target: string;
  record_id: string;
}

const ACTION_LABEL: Record<string, string> = { insert: "追加", update: "変更", delete: "削除" };
const TARGET_LABEL: Record<string, string> = {
  settings: "設定",
  links: "外部リンク",
  staff: "職員",
  vehicles: "車両",
  committees: "委員会",
  criteria: "評価項目",
  notices: "お知らせ",
  vehicleLogs: "運行記録",
  alcoholChecks: "アルコールチェック",
  minutes: "議事録",
  evaluations: "人事評価",
  parkingLots: "駐車場",
  parkingSpaces: "駐車区画",
  jobDescriptions: "職務記述書",
  nanbyoPatients: "難病(患者)",
  nanbyoEntries: "難病(記録)",
  salesActivities: "営業記録",
  finance: "経営数値",
  subsidies: "補助金",
  personalSales: "個人売上",
  goals: "目標",
  goalSheets: "目標シート",
  consultationDesks: "相談窓口",
  dailySales: "日次売上",
  feeRates: "報酬単価",
};

/** サーバー(Supabase)への移行と、監査ログ(誰がいつ何を変えたか)の確認 */
export function ServerDataSection() {
  const mode = useSync((s) => s.mode);
  const me = useAuth((s) => s.member);
  const staff = usePortalStore((s) => s.staff);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [logs, setLogs] = useState<AuditRow[] | null>(null);
  const isAdmin = !!me?.is_admin;
  const staffName = (id: string | null) => (id ? (staff.find((s) => s.id === id)?.name ?? id) : "(システム)");

  async function upload(kind: "all" | "master") {
    const text =
      kind === "all"
        ? "このブラウザのデータ(サンプルを含むすべて)をサーバーに登録します。以後は全職員で同じデータを使います。よろしいですか?"
        : "職員・外部リンク・車両・駐車場・委員会・評価項目・職務記述書・相談窓口・報酬単価・設定だけをサーバーに登録し、記録(運行記録・売上など)は空の状態で始めます。よろしいですか?";
    if (!confirm(text)) return;
    setBusy(true);
    setMessage(null);
    try {
      await uploadLocalToServer(kind);
      setMessage("✓ サーバーに登録しました。これから全職員が同じデータを使います。");
    } catch (e) {
      const err = e as { message?: string };
      setMessage(`⚠ 登録できませんでした: ${err.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function loadLogs() {
    setBusy(true);
    const { data, error } = await supabase().from("portal_audit_log").select("*").order("at", { ascending: false }).limit(200);
    setBusy(false);
    if (error) return setMessage(`⚠ 監査ログを読み込めませんでした: ${error.message}`);
    setLogs((data ?? []) as AuditRow[]);
  }

  if (mode === "server") {
    return (
      <div className="space-y-3">
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          🔒 データはサーバー(Supabase)に保存され、全職員で共有しています。誰が何を見られるか・変えられるかはサーバーが役職をもとに判定します。
        </p>
        {isAdmin && (
          <div>
            <button type="button" className={buttonClass.secondary} disabled={busy} onClick={loadLogs}>
              📜 監査ログ(最近200件)を表示
            </button>
            {logs && (
              <div className="mt-3 max-h-96 overflow-auto rounded-lg border border-slate-200">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
                    <tr>
                      <th className="px-2 py-1.5">日時</th>
                      <th className="px-2 py-1.5">操作した人</th>
                      <th className="px-2 py-1.5">操作</th>
                      <th className="px-2 py-1.5">対象</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((l) => (
                      <tr key={l.id} className="border-t border-slate-100">
                        <td className="whitespace-nowrap px-2 py-1">{new Date(l.at).toLocaleString("ja-JP")}</td>
                        <td className="px-2 py-1">{staffName(l.actor_staff)}</td>
                        <td className="px-2 py-1">{ACTION_LABEL[l.action] ?? l.action}</td>
                        <td className="px-2 py-1">
                          {TARGET_LABEL[l.target] ?? l.target}
                          <span className="ml-1 text-slate-400">{l.record_id}</span>
                        </td>
                      </tr>
                    ))}
                    {logs.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-2 py-3 text-center text-slate-400">
                          記録はありません
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        {message && <p className="text-sm text-slate-700">{message}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
        ⚠ いまはデータがこの端末のブラウザだけに保存されています。他の職員とは共有されず、閲覧の制限も画面の表示だけです。
        Supabase で <code className="rounded bg-white px-1">supabase/security.sql</code> を実行してから、下のボタンでサーバーに登録してください。
      </p>
      {isAdmin ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={buttonClass.primary} disabled={busy || mode === "loading"} onClick={() => upload("master")}>
            ☁ マスタだけ登録して始める(おすすめ)
          </button>
          <button type="button" className={buttonClass.secondary} disabled={busy || mode === "loading"} onClick={() => upload("all")}>
            ☁ このブラウザのデータをすべて登録
          </button>
        </div>
      ) : (
        <p className="text-xs text-slate-500">サーバーへの登録は経営者・統括部長が行います。</p>
      )}
      {message && <p className="text-sm text-slate-700">{message}</p>}
    </div>
  );
}

/** 保存中・保存できなかったときの表示(画面の右下) */
export function SyncStatus() {
  const saving = useSync((s) => s.saving);
  const error = useSync((s) => s.error);
  if (error) {
    return (
      <div role="alert" className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg bg-rose-600 px-4 py-3 text-sm text-white shadow-lg">
        <p>⚠ {error}</p>
        <p className="mt-1 text-xs text-rose-100">画面はサーバーに保存されている内容に戻しました。</p>
        <button type="button" className="mt-2 rounded bg-white/20 px-2 py-0.5 text-xs font-semibold hover:bg-white/30" onClick={() => useSync.setState({ error: null })}>
          閉じる
        </button>
      </div>
    );
  }
  if (saving > 0) {
    return <div className="fixed bottom-4 right-4 z-50 rounded-full bg-brand-700 px-3 py-1.5 text-xs text-white shadow">保存中…</div>;
  }
  return null;
}
