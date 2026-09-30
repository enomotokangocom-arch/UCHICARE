"use client";

import Link from "next/link";
import { use } from "react";
import { fmtDate, todayLocal, useApi } from "@/onboarding/ui/client";
import { Alert, Button } from "@/onboarding/ui/kit";
import { HireDetail } from "@/onboarding/ui/types";
import { HIRE_STATUS_LABELS, HireStatus, REQUEST_STATUS_LABELS, RequestStatus, REQUIREMENT_LABELS, Requirement, TASK_STATUS_LABELS, TaskStatus, PLACEMENT_LABELS, Placement } from "@/onboarding/shared/labels";

const box = (on: unknown) => (on ? "☑" : "☐");

/** 入職者ごとのチェックリスト(印刷用)。認証情報の参照先はサーバー側で除外されています。 */
export default function PrintHire({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: d, error } = useApi<HireDetail>(`/hires/${id}?print=1`);
  if (error) return <Alert tone="error">{error}</Alert>;
  if (!d) return <p className="text-sm text-slate-400">読み込み中...</p>;
  const h = d.hire;
  return (
    <div className="mx-auto max-w-4xl bg-white p-6 text-[12px] leading-relaxed print:p-0">
      <div className="mb-4 flex gap-2 print:hidden">
        <Button onClick={() => window.print()}>印刷する</Button>
        <Link href={`/onboarding/hires/${h.id}`} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">戻る</Link>
      </div>
      <h1 className="text-lg font-bold">入職前システム準備チェックリスト</h1>
      <p className="text-slate-500">印刷日 {fmtDate(todayLocal())} ・ 状態 {HIRE_STATUS_LABELS[h.status as HireStatus]} ・ パスワード等の認証情報は記載していません</p>
      <table className="mt-3 w-full border-collapse [&_td]:border [&_td]:border-slate-400 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-slate-400 [&_th]:bg-slate-100 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left">
        <tbody>
          <tr><th>氏名</th><td>{h.name}({h.name_romaji})</td><th>職種</th><td>{h.job_type_name ?? "未設定"}</td></tr>
          <tr><th>部門・事業所</th><td>{h.department_name} / {h.office_name ?? "未設定"}</td><th>入社日</th><td>{fmtDate(h.start_date)}(準備期限 {fmtDate(h.prep_deadline)})</td></tr>
          <tr><th>準備担当者</th><td>{h.preparer_name ?? "未設定"}(代行 {h.deputy_name ?? "未設定"})</td><th>確認管理者</th><td>{h.checker_name ?? "未設定"}</td></tr>
          <tr><th>Appleメール</th><td colSpan={3}>{d.confirmedEmail ?? (d.activeApple ? `${d.activeApple.planned_email}(予約中・未作成)` : "未予約")}</td></tr>
          <tr><th>端末</th><td colSpan={3}>{d.devices.map((v) => `${v.kind} ${v.asset_no}${v.serial ? `(S/N ${v.serial})` : ""}`).join(" / ") || "未割当"}</td></tr>
        </tbody>
      </table>

      <h2 className="mt-5 font-bold">作業チェックリスト(必須 {d.progress.required_done}/{d.progress.required_total})</h2>
      <table className="mt-1 w-full border-collapse [&_td]:border [&_td]:border-slate-400 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-slate-400 [&_th]:bg-slate-100 [&_th]:px-1 [&_th]:py-1">
        <thead><tr><th>No</th><th>作業</th><th>区分</th><th>担当</th><th>期限</th><th>iPhone</th><th>iPad</th><th>状態</th><th>完了日・完了者</th></tr></thead>
        <tbody>
          {d.tasks.map((t, i) => (
            <tr key={t.id}>
              <td className="text-center">{i + 1}</td><td>{t.title}{t.na_reason ? `(対象外: ${t.na_reason})` : ""}</td>
              <td>{t.requirement === "required" ? "必須" : "任意"}</td><td>{t.assignee_name ?? ""}</td><td>{fmtDate(t.due_date)}</td>
              <td className="text-center">{t.device_check === "both" ? box(t.iphone_checked_at) : "—"}</td>
              <td className="text-center">{t.device_check === "both" ? box(t.ipad_checked_at) : "—"}</td>
              <td>{TASK_STATUS_LABELS[t.status as TaskStatus]}</td><td>{t.completed_at ? `${fmtDate(t.completed_at)} ${t.completed_by_name ?? ""}` : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="mt-5 font-bold">サービス別の確認</h2>
      <table className="mt-1 w-full border-collapse [&_td]:border [&_td]:border-slate-400 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-slate-400 [&_th]:bg-slate-100 [&_th]:px-1 [&_th]:py-1">
        <thead><tr><th>サービス</th><th>区分</th><th>配置方式</th><th>配置 iPhone</th><th>配置 iPad</th><th>ログイン iPhone</th><th>ログイン iPad</th><th>内容確認</th><th>発行状況</th></tr></thead>
        <tbody>
          {d.services.map((s) => {
            const r = d.requests.find((x) => x.service_id === s.service_id);
            return (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{REQUIREMENT_LABELS[s.requirement as Requirement]}{s.requirement === "confirm" ? `(${s.usage_decision === "use" ? "使用" : s.usage_decision === "not_use" ? "不使用" : "未確認"})` : ""}</td>
                <td>{s.placement_confirmed ? PLACEMENT_LABELS[s.placement as Placement] : "未確定"}</td>
                <td className="text-center">{box(s.iphone_placed_at)}</td><td className="text-center">{box(s.ipad_placed_at)}</td>
                <td className="text-center">{box(s.iphone_login_at)}</td><td className="text-center">{box(s.ipad_login_at)}</td>
                <td className="text-center">{box(s.verified_at)}</td>
                <td>{r ? `${REQUEST_STATUS_LABELS[r.status as RequestStatus]}${r.issued_login_id ? ` ID:${r.issued_login_id}` : ""}` : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h2 className="mt-5 font-bold">未完了項目</h2>
      {d.openItems.length === 0 ? <p>なし</p> : (
        <ul className="list-disc pl-5">{d.openItems.map((o, i) => <li key={i}>{o.kind}: {o.title} / 対応者 {o.assignee ?? "未設定"} / 期限 {o.due ? fmtDate(o.due) : "未設定"}</li>)}</ul>
      )}

      <h2 className="mt-5 font-bold">確認・貸与の記録</h2>
      <table className="mt-1 w-full border-collapse [&_td]:border [&_td]:border-slate-400 [&_td]:px-2 [&_td]:py-3 [&_th]:border [&_th]:border-slate-400 [&_th]:bg-slate-100 [&_th]:px-2">
        <tbody>
          <tr><th className="w-40">管理者確認</th><td>{h.confirmed_at ? `${fmtDate(h.confirmed_at)} ${h.confirmed_by_name}:${h.confirm_note}` : "確認日:        確認者(署名):"}</td></tr>
          <tr><th>貸与・操作説明</th><td>{h.lent_date ? `${fmtDate(h.lent_date)} ${h.lent_by_name}:${h.explanation_note}` : "貸与日:        説明者:        受領者(署名):"}</td></tr>
        </tbody>
      </table>
    </div>
  );
}
