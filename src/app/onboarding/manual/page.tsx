"use client";

import { useState } from "react";
import { fmtDate, Options, useApi } from "@/onboarding/ui/client";
import { isBrowserDemo } from "@/onboarding/ui/nav";
import { Alert, Button, inputCls } from "@/onboarding/ui/kit";
import { ACCOUNT_TYPE_LABELS, AccountType, OWNER_MODE_LABELS, OwnerMode, PLACEMENT_LABELS, Placement, REQUIREMENT_LABELS, Requirement } from "@/onboarding/shared/labels";

type Manual = {
  department: { id: number; name: string };
  templates: { title: string; requirement: string; assignee_type: string; procedure: string; completion_criteria: string; account_info: string; device_check: string; due_offset_days: number; version: number; updated_at: string | null; updated_by_name: string | null; condition: string | null }[];
  services: { name: string; requirement: string; placement: string; placement_confirmed: number; url: string | null; app_store_url: string | null; account_type: string; account_note: string | null; needs_issuance: number; requires_email: number; issuer_label: string | null; issuer_name: string | null; owner_mode: string; procedure: string | null; completion_criteria: string | null; updated_at: string | null; updated_by_name: string | null }[];
  excluded: { name: string }[];
};

/** 部門別の標準手順書(印刷用)。認証情報の参照先は含みません。 */
export default function ManualPage() {
  const { data: opts } = useApi<Options>("/options");
  const [dept, setDept] = useState("");
  const deptId = dept || (opts?.departments[0] ? String(opts.departments[0].id) : "");
  const { data: m, error } = useApi<Manual>(deptId ? `/manual/${deptId}` : null);
  return (
    <div className="mx-auto max-w-4xl bg-white p-6 text-[13px] leading-relaxed print:p-0">
      <div className="mb-4 flex flex-wrap items-end gap-2 print:hidden">
        <label className="text-xs font-semibold text-slate-600">部門
          <select className={inputCls} value={deptId} onChange={(e) => setDept(e.target.value)}>
            {opts?.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        {!isBrowserDemo() && <Button onClick={() => window.print()}>印刷する</Button>}
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      {m && (
        <>
          <h1 className="text-xl font-bold">入職前システム準備 標準手順書({m.department.name})</h1>
          <p className="text-xs text-slate-500">株式会社Uchi care ・ 印刷日 {fmtDate(new Date().toISOString())} ・ パスワード等の認証情報は記載していません(認証情報管理ツールを参照)</p>

          <h2 className="mt-5 border-b border-slate-300 pb-1 text-base font-bold">対象サービス</h2>
          <table className="mt-2 w-full border-collapse text-xs [&_td]:border [&_td]:border-slate-400 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-slate-400 [&_th]:bg-slate-100 [&_th]:px-2">
            <thead><tr><th>サービス</th><th>区分</th><th>配置方式・URL</th><th>アカウント</th><th>発行担当</th><th>更新</th></tr></thead>
            <tbody>
              {m.services.map((s) => (
                <tr key={s.name}>
                  <td className="font-semibold">{s.name}</td>
                  <td>{REQUIREMENT_LABELS[s.requirement as Requirement]}</td>
                  <td>{s.placement_confirmed ? PLACEMENT_LABELS[s.placement as Placement] : "未確定(既存端末で確認)"}{s.url && <div className="break-all">{s.url}</div>}{s.app_store_url && <div className="break-all">{s.app_store_url}</div>}</td>
                  <td>{ACCOUNT_TYPE_LABELS[s.account_type as AccountType]}{s.account_note && <div className="text-slate-600">{s.account_note}</div>}</td>
                  <td>{s.needs_issuance ? <>{s.issuer_label ?? "未設定"}{s.issuer_name ? `(${s.issuer_name})` : ""}<div>{OWNER_MODE_LABELS[s.owner_mode as OwnerMode]}</div>{s.requires_email ? <div>メール確定後に依頼</div> : null}</> : "—"}</td>
                  <td>{fmtDate(s.updated_at)}<div>{s.updated_by_name ?? "初期登録"}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
          {m.excluded.length > 0 && <p className="mt-1 text-xs">この部門で対象外: {m.excluded.map((e) => e.name).join("、")}</p>}

          <h2 className="mt-6 border-b border-slate-300 pb-1 text-base font-bold">標準チェックリスト</h2>
          {m.templates.map((t, i) => (
            <section key={t.title} className="mt-4 break-inside-avoid">
              <h3 className="font-bold">{i + 1}. {t.title} <span className="text-xs font-normal text-slate-500">({t.requirement === "required" ? "必須" : "任意"}・担当: {t.assignee_type === "checker" ? "確認管理者" : "準備担当者"}・標準期限: 入社日の{Math.abs(t.due_offset_days)}日{t.due_offset_days <= 0 ? "前" : "後"}{t.device_check === "both" ? "・iPhone/iPadそれぞれ確認" : ""}{t.condition ? "・配置方式が未確定のサービスがある場合のみ" : ""})</span></h3>
              <pre className="mt-1 whitespace-pre-wrap font-sans">{t.procedure}</pre>
              <p className="mt-1"><b>完了条件:</b> {t.completion_criteria}</p>
              {t.account_info && <p><b>使用するアカウント:</b> {t.account_info}</p>}
              <p className="text-[11px] text-slate-500">第{t.version}版 ・ 更新 {fmtDate(t.updated_at)} {t.updated_by_name ?? "初期登録"}</p>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
