"use client";

import { ChangeEvent, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ADMIN_POSITIONS, generateInviteCode, Member } from "@/lib/portal/auth";
import { normalizePosition } from "@/lib/portal/logic";
import { usePortalStore } from "@/lib/portal/store";
import { BUSINESS_UNITS, unitName } from "@/lib/portal/defaults";
import { readCsvFile, findHeaderRow } from "@/lib/portal/salesImport";
import { BusinessUnitId, Position, Staff, StaffRole } from "@/lib/portal/types";
import { downloadCsv, newId, todayString } from "@/lib/portal/util";
import { StatusPill, buttonClass } from "@/components/portal/ui";

const ROLES: StaffRole[] = ["管理者", "看護師", "准看護師", "理学療法士", "作業療法士", "言語聴覚士", "ケアマネジャー", "事務", "店舗スタッフ", "その他"];
const norm = (s: string) => s.normalize("NFKC").replace(/\s/g, "");
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export function inviteMessage(m: Pick<Member, "name" | "email" | "invite_code">) {
  return [
    `${m.name} さん`,
    "Uchi care 社内ポータルの登録のご案内です。",
    `URL: ${typeof window !== "undefined" ? window.location.origin : ""}`,
    `メールアドレス: ${m.email}`,
    `招待コード: ${m.invite_code}`,
    "ログイン画面の「はじめての登録」から、メールアドレス・招待コードを入れて、自分のパスワードを決めてください。",
  ].join("\n");
}

type Row = {
  name: string;
  email: string;
  position: Position;
  unitId: BusinessUnitId;
  role: StaffRole | null;
  staff: Staff | null;
  status: "new" | "skip" | "error";
  reason: string;
};

function pickCol(headers: string[], re: RegExp) {
  return headers.findIndex((h) => re.test(norm(h)));
}

/** CSVで一括招待・招待コードの一括書き出し */
export function BulkInvite({ members, onDone }: { members: Member[]; onDone: () => Promise<void> }) {
  const staff = usePortalStore((s) => s.staff);
  const collection = usePortalStore((s) => s.collection);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const pending = members.filter((m) => m.active && !m.user_id && m.invite_code);

  /** アカウントがまだない職員の一覧(メール欄を埋めて取り込む用) */
  function downloadTemplate() {
    const free = staff.filter((s) => s.active && !members.some((m) => m.staff_id === s.id));
    downloadCsv(
      `招待用_職員一覧_${todayString()}.csv`,
      ["氏名", "メールアドレス", "役職", "事業所", "職種"],
      free.map((s) => [s.name, "", s.position, unitName(s.unitId), s.role])
    );
  }

  function downloadCodes() {
    downloadCsv(
      `招待コード一覧_${todayString()}.csv`,
      ["氏名", "メールアドレス", "招待コード", "案内文"],
      pending.map((m) => [m.name, m.email, m.invite_code, inviteMessage(m)])
    );
  }

  async function copyAll() {
    await navigator.clipboard.writeText(pending.map(inviteMessage).join("\n\n――――――――――\n\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setMessage(null);
    try {
      const data = await readCsvFile(file);
      const h = findHeaderRow(data);
      const headers = data[h] ?? [];
      const ci = {
        name: pickCol(headers, /氏名|名前|職員/),
        email: pickCol(headers, /メール|mail/i),
        position: pickCol(headers, /役職/),
        unit: pickCol(headers, /事業所|部署|所属/),
        role: pickCol(headers, /職種/),
      };
      if (ci.name < 0 || ci.email < 0) throw new Error("「氏名」と「メールアドレス」の列が見つかりません。ひな形のCSVをお使いください。");
      const seen = new Set<string>();
      const parsed: Row[] = data
        .slice(h + 1)
        .map((r) => {
          const name = (r[ci.name] ?? "").trim();
          const email = (r[ci.email] ?? "").trim().toLowerCase();
          const posRaw = ci.position >= 0 ? (r[ci.position] ?? "").trim() : "";
          const unitRaw = ci.unit >= 0 ? norm(r[ci.unit] ?? "") : "";
          const roleRaw = ci.role >= 0 ? (r[ci.role] ?? "").trim() : "";
          const st = staff.find((s) => norm(s.name) === norm(name)) ?? null;
          const position: Position = posRaw ? normalizePosition(posRaw) : st?.position ?? "一般スタッフ";
          const unitId = BUSINESS_UNITS.find((u) => norm(u.name) === unitRaw || norm(u.shortName) === unitRaw)?.id ?? st?.unitId ?? "houkan";
          const role = (ROLES as string[]).includes(roleRaw) ? (roleRaw as StaffRole) : null;
          let status: Row["status"] = "new";
          let reason = st ? "職員と結びつけて招待" : "新しい職員として追加して招待";
          if (!name || !email) {
            status = "skip";
            reason = "氏名またはメールアドレスが空";
          } else if (!isEmail(email)) {
            status = "error";
            reason = "メールアドレスの形が正しくありません";
          } else if (members.some((m) => m.email.toLowerCase() === email)) {
            status = "skip";
            reason = "このメールアドレスは登録済み";
          } else if (st && members.some((m) => m.staff_id === st.id)) {
            status = "skip";
            reason = "この職員はアカウント登録済み";
          } else if (seen.has(email)) {
            status = "error";
            reason = "CSVの中でメールアドレスが重複";
          }
          seen.add(email);
          return { name, email, position, unitId, role, staff: st, status, reason };
        })
        .filter((r) => r.name || r.email);
      setRows(parsed);
    } catch (err) {
      setRows(null);
      setMessage(`⚠ ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function doInvite() {
    if (!rows) return;
    const targets = rows.filter((r) => r.status === "new");
    if (!targets.length) return;
    setBusy(true);
    setMessage(null);
    const records = targets.map((r) => {
      let s = r.staff;
      if (!s) {
        s = {
          id: newId("s"),
          name: r.name.normalize("NFKC").replace(/\s+/g, " ").trim(),
          unitId: r.unitId,
          role: r.role ?? "看護師",
          position: r.position,
          isDriver: true,
          isSafetyManager: false,
          isEvaluator: ADMIN_POSITIONS.includes(r.position),
          active: true,
        };
        collection("staff").add(s);
      } else if (s.position !== r.position || s.unitId !== r.unitId || (r.role && s.role !== r.role)) {
        collection("staff").update(s.id, { position: r.position, unitId: r.unitId, ...(r.role ? { role: r.role } : {}) });
      }
      return {
        email: r.email,
        staff_id: s.id,
        name: s.name,
        unit_id: r.unitId,
        position: r.position,
        is_admin: ADMIN_POSITIONS.includes(r.position),
        invite_code: generateInviteCode(),
      };
    });
    const { error } = await supabase().from("portal_members").insert(records);
    setBusy(false);
    if (error) {
      setMessage(`⚠ 招待できませんでした: ${/duplicate|unique/i.test(error.message) ? "登録済みのメールアドレスが含まれています。" : error.message}`);
      return;
    }
    setRows(null);
    setMessage(`${records.length}名の招待コードを発行しました。「招待コード一覧(CSV)」または「案内文をまとめてコピー」で送ってください。`);
    await onDone();
  }

  const newCount = rows?.filter((r) => r.status === "new").length ?? 0;

  return (
    <div className="space-y-3 rounded-lg border border-brand-200 bg-brand-50/40 p-3">
      <h3 className="text-sm font-bold text-slate-900">📄 CSVでまとめて招待する</h3>
      <ol className="list-decimal space-y-1 pl-5 text-xs text-slate-600">
        <li>「ひな形をダウンロード」で、まだアカウントのない職員の一覧(CSV)を出し、Excelでメールアドレスの列を入力して保存します(新しい職員は行を足してください)。</li>
        <li>「CSVを取り込む」で選ぶと、確認画面が出ます。「招待コードを発行」で全員分を一度に発行します。</li>
        <li>「招待コード一覧(CSV)」または「案内文をまとめてコピー」で、本人に送ります。</li>
      </ol>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass.secondary} onClick={downloadTemplate}>
          ⬇ ひな形をダウンロード
        </button>
        <label className={`${buttonClass.primary} cursor-pointer`}>
          ⬆ CSVを取り込む
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
        </label>
        <span className="mx-1 hidden border-l border-slate-300 sm:block" />
        <button type="button" className={buttonClass.secondary} disabled={!pending.length} onClick={downloadCodes}>
          ⬇ 招待コード一覧(CSV・{pending.length}名)
        </button>
        <button type="button" className={buttonClass.secondary} disabled={!pending.length} onClick={copyAll}>
          {copied ? "✓ コピーしました" : `📋 案内文をまとめてコピー(${pending.length}名)`}
        </button>
      </div>

      {rows && (
        <div className="space-y-2 rounded-lg bg-white p-3">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-xs text-slate-500">
                <tr className="text-left">
                  {["氏名", "メールアドレス", "役職", "事業所", "結果"].map((h) => (
                    <th key={h} className="px-2 py-1 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r, i) => (
                  <tr key={i} className={r.status === "new" ? "" : "text-slate-400"}>
                    <td className="px-2 py-1.5">{r.name || "-"}</td>
                    <td className="px-2 py-1.5 text-xs">{r.email || "-"}</td>
                    <td className="px-2 py-1.5 text-xs">{r.position}</td>
                    <td className="px-2 py-1.5 text-xs">{unitName(r.unitId)}</td>
                    <td className="px-2 py-1.5">
                      <StatusPill tone={r.status === "new" ? "ok" : r.status === "error" ? "danger" : "neutral"}>{r.reason}</StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={buttonClass.primary} disabled={busy || !newCount} onClick={doInvite}>
              {busy ? "発行しています..." : `${newCount}名の招待コードを発行`}
            </button>
            <button type="button" className={buttonClass.ghost} onClick={() => setRows(null)}>
              やめる
            </button>
          </div>
        </div>
      )}
      {message && <p className={`rounded-lg px-3 py-2 text-sm ${message.startsWith("⚠") ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>{message}</p>}
    </div>
  );
}
