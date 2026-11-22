"use client";

import { useState } from "react";
import clsx from "clsx";
import { usePortalStore, useCurrentStaff } from "@/lib/portal/store";
import { isAdmin } from "@/lib/portal/logic";
import { JobDescription, Position } from "@/lib/portal/types";
import { Card, Field, PageContainer, PageHeader, UnitBadge, buttonClass, inputClass } from "@/components/portal/ui";

/** 組織図の段(上から) */
const ORG_ROWS: Position[][] = [["経営者"], ["統括部長", "事務長"], ["所長"], ["リハ責任者", "主任"], ["リーダー"], ["スタッフ"]];

const SECTIONS: { key: keyof JobDescription; label: string; list?: boolean }[] = [
  { key: "mission", label: "ミッション(役割の目的)" },
  { key: "responsibilities", label: "主な責務", list: true },
  { key: "authority", label: "権限" },
  { key: "qualifications", label: "必要な資格・経験" },
  { key: "kpis", label: "評価指標(KPI)", list: true },
];

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

export default function JobDescriptionsPage() {
  const jds = usePortalStore((s) => s.jobDescriptions);
  const staff = usePortalStore((s) => s.staff);
  const collection = usePortalStore((s) => s.collection);
  const resetJobDescriptions = usePortalStore((s) => s.resetJobDescriptions);
  const current = useCurrentStaff();
  const canEdit = isAdmin(current);

  const [selected, setSelected] = useState<Position>(current?.position ?? "スタッフ");
  const [editing, setEditing] = useState(false);
  const jd = jds.find((j) => j.position === selected);
  const holders = staff.filter((s) => s.active && s.position === selected);

  function printAll() {
    const body = ORG_ROWS.flat()
      .map((p) => jds.find((j) => j.position === p))
      .filter((j): j is JobDescription => !!j)
      .map(
        (j) => `<section><h2>${escapeHtml(j.position)}</h2><p class="sub">報告先: ${escapeHtml(j.reportsTo)}</p><table>${SECTIONS.map(
          (s) =>
            `<tr><th>${s.label}</th><td>${
              s.list
                ? `<ul>${String(j[s.key]).split("\n").filter(Boolean).map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`
                : escapeHtml(String(j[s.key]))
            }</td></tr>`
        ).join("")}</table></section>`
      )
      .join("");
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>職務記述書 株式会社Uchi care</title>
<style>body{font-family:sans-serif;padding:24px;color:#111}h1{text-align:center;font-size:20px}section{page-break-after:always;margin-bottom:32px}h2{font-size:18px;border-bottom:2px solid #30445c;padding-bottom:4px;margin-bottom:2px}
.sub{color:#555;font-size:12px;margin-top:2px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #999;padding:8px;font-size:13px;vertical-align:top;text-align:left}th{width:22%;background:#f3f3f3}ul{margin:0;padding-left:18px}</style></head>
<body><h1>職務記述書(ジョブディスクリプション) 株式会社Uchi care</h1>${body}</body></html>`);
    w.document.close();
    w.focus();
    w.print();
  }

  return (
    <PageContainer>
      <PageHeader
        icon="📘"
        title="職務記述書"
        description="役職ごとの役割・責務・権限・評価指標です。役職を選ぶと内容を確認できます。"
        actions={
          <>
            <button type="button" className={buttonClass.secondary} onClick={printAll}>
              🖨 全役職を印刷
            </button>
            {canEdit && (
              <button
                type="button"
                className={buttonClass.ghost}
                onClick={() => confirm("職務記述書を初期の内容に戻しますか?編集した内容は失われます。") && resetJobDescriptions()}
              >
                初期内容に戻す
              </button>
            )}
          </>
        }
      />

      <Card className="mb-5">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">組織図</h2>
        <div className="flex flex-col items-center gap-1.5">
          {ORG_ROWS.map((row, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              {i > 0 && <span className="h-3 w-px bg-slate-300" aria-hidden />}
              <div className="flex flex-wrap justify-center gap-2">
                {row.map((p) => {
                  const count = staff.filter((s) => s.active && s.position === p).length;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setSelected(p);
                        setEditing(false);
                      }}
                      className={clsx(
                        "min-w-28 rounded-lg border px-4 py-2 text-sm font-bold transition",
                        selected === p ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-brand-400"
                      )}
                    >
                      {p}
                      <span className={clsx("ml-1.5 text-[11px] font-normal", selected === p ? "text-brand-100" : "text-slate-400")}>{count}名</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {jd ? (
        <Card>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{jd.position}</h2>
              <p className="mt-0.5 text-sm text-slate-500">報告先: {jd.reportsTo}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                {holders.length === 0 ? (
                  <span className="text-slate-400">この役職の職員は登録されていません</span>
                ) : (
                  holders.map((h) => (
                    <span key={h.id} className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5">
                      {h.name} <UnitBadge unitId={h.unitId} />
                    </span>
                  ))
                )}
              </div>
            </div>
            {canEdit && (
              <button type="button" className={editing ? buttonClass.primary : buttonClass.secondary} onClick={() => setEditing(!editing)}>
                {editing ? "編集を終える" : "編集する"}
              </button>
            )}
          </div>

          <div className="mt-5 space-y-5">
            {editing && (
              <Field label="報告先(上長)">
                <input className={inputClass} value={jd.reportsTo} onChange={(e) => collection("jobDescriptions").update(jd.id, { reportsTo: e.target.value })} />
              </Field>
            )}
            {SECTIONS.map((sec) => {
              const value = String(jd[sec.key]);
              if (editing) {
                return (
                  <Field key={sec.key} label={sec.label} hint={sec.list ? "1行に1項目" : undefined}>
                    <textarea
                      className={`${inputClass} ${sec.list ? "min-h-48" : "min-h-20"}`}
                      value={value}
                      onChange={(e) => collection("jobDescriptions").update(jd.id, { [sec.key]: e.target.value })}
                    />
                  </Field>
                );
              }
              return (
                <section key={sec.key}>
                  <h3 className="mb-1.5 text-xs font-bold text-brand-700">{sec.label}</h3>
                  {sec.list ? (
                    <ul className="space-y-1.5">
                      {value
                        .split("\n")
                        .filter(Boolean)
                        .map((line, i) => (
                          <li key={i} className="flex gap-2 text-sm text-slate-800">
                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                            {line}
                          </li>
                        ))}
                    </ul>
                  ) : (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{value}</p>
                  )}
                </section>
              );
            })}
          </div>
          {editing && <p className="mt-4 text-[11px] text-slate-400">入力内容は自動で保存されます</p>}
        </Card>
      ) : (
        <Card>この役職の職務記述書はまだありません。</Card>
      )}
    </PageContainer>
  );
}
