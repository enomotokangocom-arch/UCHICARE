"use client";

import { FormEvent, useState } from "react";
import { usePortalStore } from "@/lib/portal/store";
import { goalPeriodLabel, goalProgress } from "@/lib/portal/logic";
import { Goal, GoalCategory, GoalStatus } from "@/lib/portal/types";
import { newId, nowIsoLocal } from "@/lib/portal/util";
import { EmptyState, Field, ProgressBar, StatusPill, buttonClass, inputClass } from "./ui";
import { useUnsavedWarning } from "./useDraft";

export const GOAL_CATEGORIES: GoalCategory[] = ["売上", "訪問・件数", "新規獲得", "スキル・資格", "業務改善", "研修・教育", "その他"];
export const GOAL_STATUSES: GoalStatus[] = ["未着手", "進行中", "達成", "未達"];
const STATUS_TONE: Record<GoalStatus, "neutral" | "info" | "ok" | "danger"> = { 未着手: "neutral", 進行中: "info", 達成: "ok", 未達: "danger" };

type GoalForm = Pick<Goal, "title" | "category" | "targetValue" | "currentValue" | "valueUnit" | "status" | "note">;
const blank: GoalForm = { title: "", category: "訪問・件数", targetValue: null, currentValue: null, valueUnit: "件", status: "未着手", note: "" };
const numOrNull = (v: string) => (v === "" ? null : Number(v));

/** 実績を入れたときの状況: 目標に届けば「達成」、届かなくなれば「進行中」に戻す */
function statusAfterUpdate(g: Goal, value: number | null): GoalStatus {
  const reached = value !== null && g.targetValue !== null && value >= g.targetValue;
  if (reached) return "達成";
  if (g.status === "達成") return "進行中";
  if (g.status === "未着手" && value) return "進行中";
  return g.status;
}

function GoalFormFields({ initial, onSave, onCancel }: { initial: GoalForm; onSave: (f: GoalForm) => void; onCancel: () => void }) {
  const [f, setF] = useState(initial);
  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        onSave(f);
      }}
      className="space-y-3 rounded-lg border border-brand-300 bg-white p-3"
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <Field label="目標" required className="col-span-2 md:col-span-4">
          <input className={inputClass} required placeholder="例: 訪問件数 月95件 / 認定看護師の資格を取る" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </Field>
        <Field label="分類" className="md:col-span-2">
          <select className={inputClass} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as GoalCategory })}>
            {GOAL_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="目標値(数値・任意)" className="md:col-span-2">
          <input type="number" inputMode="decimal" className={inputClass} value={f.targetValue ?? ""} onChange={(e) => setF({ ...f, targetValue: numOrNull(e.target.value) })} />
        </Field>
        <Field label="現在の実績">
          <input type="number" inputMode="decimal" className={inputClass} value={f.currentValue ?? ""} onChange={(e) => setF({ ...f, currentValue: numOrNull(e.target.value) })} />
        </Field>
        <Field label="単位">
          <input className={inputClass} list="goal-units" value={f.valueUnit} onChange={(e) => setF({ ...f, valueUnit: e.target.value })} />
          <datalist id="goal-units">
            {["件", "名", "回", "円", "%", "時間"].map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </Field>
        <Field label="状況" className="md:col-span-2">
          <select className={inputClass} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as GoalStatus })}>
            {GOAL_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="取り組み・メモ" className="col-span-2 md:col-span-6">
          <input className={inputClass} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        </Field>
      </div>
      <div className="flex gap-2">
        <button type="submit" className={buttonClass.primary}>
          保存する
        </button>
        <button type="button" className={buttonClass.secondary} onClick={onCancel}>
          キャンセル
        </button>
      </div>
    </form>
  );
}

/** 目標の一覧と追加・更新。base は新規目標の scope / staffId / unitId / period */
export function GoalList({
  goals,
  canEdit,
  base,
  emptyText,
}: {
  goals: Goal[];
  canEdit: boolean;
  base: Pick<Goal, "scope" | "staffId" | "unitId" | "period">;
  emptyText: string;
}) {
  const collection = usePortalStore((s) => s.collection);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const update = (id: string, patch: Partial<Goal>) => collection("goals").update(id, { ...patch, updatedAt: nowIsoLocal() });
  // 実績・状況の変更は下書きに入れ、目標ごとの「保存」で反映する
  const [progress, setProgress] = useState<Record<string, Pick<Goal, "currentValue" | "status">>>({});
  useUnsavedWarning(Object.keys(progress).length > 0);
  const stage = (g: Goal, patch: Partial<Pick<Goal, "currentValue" | "status">>) =>
    setProgress((p) => ({ ...p, [g.id]: { ...{ currentValue: g.currentValue, status: g.status }, ...p[g.id], ...patch } }));
  const clearStage = (id: string) =>
    setProgress((p) => {
      const copy = { ...p };
      delete copy[id];
      return copy;
    });

  return (
    <div className="space-y-3">
      {goals.length === 0 && editing !== "new" && <EmptyState>{emptyText}</EmptyState>}
      {goals.map((orig) => {
        const g = progress[orig.id] ? { ...orig, ...progress[orig.id] } : orig;
        return editing === g.id ? (
          <GoalFormFields
            key={g.id}
            initial={g}
            onCancel={() => setEditing(null)}
            onSave={(f) => {
              update(g.id, f);
              setEditing(null);
            }}
          />
        ) : (
          <div key={g.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900">{g.title}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {g.category} ・ {goalPeriodLabel(g.period)}
                </p>
              </div>
              <StatusPill tone={STATUS_TONE[g.status]}>{g.status}</StatusPill>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <ProgressBar ratio={goalProgress(g)} className="flex-1" />
              {g.targetValue !== null && (
                <span className="whitespace-nowrap text-xs text-slate-600">
                  {(g.currentValue ?? 0).toLocaleString()} / {g.targetValue.toLocaleString()} {g.valueUnit}
                </span>
              )}
            </div>
            {g.note && <p className="mt-1.5 text-xs text-slate-500">📝 {g.note}</p>}
            {canEdit && (
              <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2">
                {g.targetValue !== null && (
                  <label className="flex items-center gap-1 text-xs text-slate-600">
                    実績を更新
                    <input
                      type="number"
                      inputMode="decimal"
                      className={`${inputClass} w-24 py-1`}
                      value={g.currentValue ?? ""}
                      onChange={(e) => {
                        const v = numOrNull(e.target.value);
                        stage(orig, { currentValue: v, status: statusAfterUpdate(g, v) });
                      }}
                    />
                    {g.valueUnit}
                  </label>
                )}
                <select className={`${inputClass} w-auto py-1 text-xs`} value={g.status} onChange={(e) => stage(orig, { status: e.target.value as GoalStatus })} aria-label="状況">
                  {GOAL_STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <span className="ml-auto flex gap-1">
                  {progress[g.id] && (
                    <>
                      <button
                        type="button"
                        className={`${buttonClass.primary} px-3 py-1 text-xs`}
                        onClick={() => {
                          update(g.id, progress[g.id]);
                          clearStage(g.id);
                        }}
                      >
                        保存
                      </button>
                      <button type="button" className={buttonClass.ghost} onClick={() => clearStage(g.id)}>
                        戻す
                      </button>
                    </>
                  )}
                  <button type="button" className={buttonClass.ghost} onClick={() => setEditing(g.id)}>
                    編集
                  </button>
                  <button type="button" className={buttonClass.danger} onClick={() => confirm(`「${g.title}」を削除しますか?`) && collection("goals").remove(g.id)}>
                    削除
                  </button>
                </span>
              </div>
            )}
          </div>
        );
      })}
      {canEdit &&
        (editing === "new" ? (
          <GoalFormFields
            initial={blank}
            onCancel={() => setEditing(null)}
            onSave={(f) => {
              collection("goals").add({ ...base, ...f, id: newId("g"), updatedAt: nowIsoLocal() });
              setEditing(null);
            }}
          />
        ) : (
          <button type="button" className={buttonClass.secondary} onClick={() => setEditing("new")}>
            ＋ 目標を追加
          </button>
        ))}
    </div>
  );
}
