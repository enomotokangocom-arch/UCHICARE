"use client";

import Link from "next/link";
import { FormEvent, Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePortalStore, useCurrentStaff, useStaffName } from "@/lib/portal/store";
import { RANK_GUIDE, currentPeriod, evaluationAverages, periodOptions, rankFromAverage } from "@/lib/portal/logic";
import { isAdmin as isAdminStaff } from "@/lib/portal/logic";
import { unitName } from "@/lib/portal/defaults";
import { Evaluation, EvaluationScore, EvaluationStatus } from "@/lib/portal/types";
import { formatDateTime, newId, nowIsoLocal } from "@/lib/portal/util";
import {
  Card,
  EmptyState,
  Field,
  PageContainer,
  PageHeader,
  StaffSelect,
  StatusPill,
  UnitBadge,
  buttonClass,
  inputClass,
} from "@/components/portal/ui";

const STATUS: Record<EvaluationStatus, { label: string; tone: "warn" | "info" | "ok" }> = {
  draft: { label: "自己評価 入力中", tone: "warn" },
  selfDone: { label: "評価者 評価待ち", tone: "info" },
  completed: { label: "評価確定", tone: "ok" },
};

const SCORE_LABELS = ["", "1 不十分", "2 やや不十分", "3 標準", "4 良好", "5 優秀"];

function ScoreSelect({ value, onChange, disabled }: { value: number | null; onChange: (v: number | null) => void; disabled: boolean }) {
  return (
    <select
      className={`${inputClass} py-1.5`}
      disabled={disabled}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
    >
      <option value="">-</option>
      {[1, 2, 3, 4, 5].map((n) => (
        <option key={n} value={n}>
          {SCORE_LABELS[n]}
        </option>
      ))}
    </select>
  );
}

function EvaluationDetail({ ev }: { ev: Evaluation }) {
  const criteria = usePortalStore((s) => s.criteria);
  const collection = usePortalStore((s) => s.collection);
  const current = useCurrentStaff();
  const staffName = useStaffName();
  const [draft, setDraft] = useState<Evaluation>(ev);

  const isSelf = current?.id === ev.staffId;
  const isEvaluator = current?.id === ev.evaluatorId;
  const isAdmin = isAdminStaff(current);
  const canEditSelf = isSelf && draft.status === "draft";
  const canEditEvaluator = (isEvaluator || isAdmin) && draft.status !== "completed";
  const avgs = evaluationAverages(draft, criteria);

  function setScore(criterionId: string, patch: Partial<EvaluationScore>) {
    const prev = draft.scores[criterionId] ?? { self: null, evaluator: null, comment: "" };
    setDraft({ ...draft, scores: { ...draft.scores, [criterionId]: { ...prev, ...patch } } });
  }

  function save(status?: EvaluationStatus) {
    const next = { ...draft, status: status ?? draft.status, updatedAt: nowIsoLocal() };
    collection("evaluations").update(ev.id, next);
    setDraft(next);
  }

  const missingSelf = criteria.some((c) => !draft.scores[c.id]?.self);
  const missingEval = criteria.some((c) => !draft.scores[c.id]?.evaluator);

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500">{draft.period}</p>
            <h2 className="text-lg font-bold text-slate-900">{staffName(draft.staffId)} さんの人事評価</h2>
            <p className="mt-0.5 text-xs text-slate-500">評価者: {staffName(draft.evaluatorId)} ・ 最終更新 {formatDateTime(draft.updatedAt)}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-[11px] text-slate-500">自己平均</p>
              <p className="text-lg font-bold text-slate-700">{avgs.self?.toFixed(1) ?? "-"}</p>
            </div>
            <div className="text-center">
              <p className="text-[11px] text-slate-500">評価者平均</p>
              <p className="text-lg font-bold text-brand-700">{avgs.evaluator?.toFixed(1) ?? "-"}</p>
            </div>
            <div className="text-center">
              <p className="text-[11px] text-slate-500">総合ランク</p>
              <p className="text-2xl font-black text-brand-700">{rankFromAverage(avgs.evaluator)}</p>
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <StatusPill tone={STATUS[draft.status].tone}>{STATUS[draft.status].label}</StatusPill>
          <span className="text-[11px] text-slate-400">{RANK_GUIDE}</span>
        </div>
      </Card>

      <Card className="p-0 sm:p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2 font-semibold">評価項目</th>
                <th className="w-36 px-2 py-2 font-semibold">自己評価</th>
                <th className="w-36 px-2 py-2 font-semibold">評価者評価</th>
                <th className="px-4 py-2 font-semibold">評価者コメント</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {criteria.map((c) => {
                const s = draft.scores[c.id] ?? { self: null, evaluator: null, comment: "" };
                return (
                  <tr key={c.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">{c.name}</p>
                      <p className="text-[11px] text-slate-500">{c.description}</p>
                    </td>
                    <td className="px-2 py-3">
                      <ScoreSelect value={s.self} disabled={!canEditSelf} onChange={(v) => setScore(c.id, { self: v })} />
                    </td>
                    <td className="px-2 py-3">
                      <ScoreSelect value={s.evaluator} disabled={!canEditEvaluator} onChange={(v) => setScore(c.id, { evaluator: v })} />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        className={`${inputClass} py-1.5`}
                        disabled={!canEditEvaluator}
                        value={s.comment}
                        onChange={(e) => setScore(c.id, { comment: e.target.value })}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Field label="次期の目標(本人記入)">
          <textarea className={`${inputClass} min-h-28`} disabled={!canEditSelf} value={draft.goals} onChange={(e) => setDraft({ ...draft, goals: e.target.value })} />
        </Field>
        <Field label="自己評価コメント(本人記入)">
          <textarea
            className={`${inputClass} min-h-28`}
            disabled={!canEditSelf}
            value={draft.selfComment}
            onChange={(e) => setDraft({ ...draft, selfComment: e.target.value })}
          />
        </Field>
        <Field label="総評(評価者記入)">
          <textarea
            className={`${inputClass} min-h-28`}
            disabled={!canEditEvaluator}
            value={draft.evaluatorComment}
            onChange={(e) => setDraft({ ...draft, evaluatorComment: e.target.value })}
          />
        </Field>
      </div>

      <div className="flex flex-wrap gap-2">
        {(canEditSelf || canEditEvaluator) && (
          <button type="button" className={buttonClass.secondary} onClick={() => save()}>
            一時保存
          </button>
        )}
        {canEditSelf && (
          <button
            type="button"
            className={buttonClass.primary}
            disabled={missingSelf}
            title={missingSelf ? "すべての項目の自己評価を入力してください" : undefined}
            onClick={() => confirm("自己評価を提出しますか?提出後は編集できません。") && save("selfDone")}
          >
            自己評価を提出する
          </button>
        )}
        {canEditEvaluator && draft.status === "selfDone" && (
          <button
            type="button"
            className={buttonClass.primary}
            disabled={missingEval}
            title={missingEval ? "すべての項目の評価者評価を入力してください" : undefined}
            onClick={() => confirm("評価を確定しますか?") && save("completed")}
          >
            評価を確定する
          </button>
        )}
        {isAdmin && draft.status !== "draft" && (
          <button
            type="button"
            className={buttonClass.ghost}
            onClick={() => confirm("差し戻して本人の自己評価入力に戻しますか?") && save("draft")}
          >
            差し戻す
          </button>
        )}
        {!canEditSelf && !canEditEvaluator && (
          <p className="text-xs text-slate-400">
            {isSelf ? "提出済みのため編集できません。" : "この評価表を編集する権限がありません(閲覧のみ)。"}
          </p>
        )}
      </div>
    </div>
  );
}

function EvaluationsInner() {
  const evaluations = usePortalStore((s) => s.evaluations);
  const staff = usePortalStore((s) => s.staff);
  const criteria = usePortalStore((s) => s.criteria);
  const collection = usePortalStore((s) => s.collection);
  const current = useCurrentStaff();
  const staffName = useStaffName();
  const router = useRouter();
  const id = useSearchParams().get("id");

  const isAdmin = isAdminStaff(current);
  const canCreate = isAdmin || current?.isEvaluator;
  const [period, setPeriod] = useState(currentPeriod());
  const [creating, setCreating] = useState(false);
  const [newForm, setNewForm] = useState({ staffIds: [] as string[], evaluatorId: current?.id ?? "", period: currentPeriod() });

  // 本人・評価者・管理者だけが閲覧できる
  const visible = useMemo(
    () =>
      evaluations.filter(
        (e) => isAdmin || e.staffId === current?.id || e.evaluatorId === current?.id
      ),
    [evaluations, isAdmin, current]
  );
  const selected = id ? visible.find((e) => e.id === id) : undefined;
  const list = visible.filter((e) => e.period === period);

  function create(e: FormEvent) {
    e.preventDefault();
    for (const staffId of newForm.staffIds) {
      if (evaluations.some((x) => x.staffId === staffId && x.period === newForm.period)) continue;
      collection("evaluations").add({
        id: newId("ev"),
        staffId,
        evaluatorId: newForm.evaluatorId,
        period: newForm.period,
        scores: {},
        goals: "",
        selfComment: "",
        evaluatorComment: "",
        status: "draft",
        updatedAt: nowIsoLocal(),
      });
    }
    setPeriod(newForm.period);
    setCreating(false);
    setNewForm({ ...newForm, staffIds: [] });
  }

  if (id) {
    return (
      <PageContainer>
        <Link href="/portal/evaluations" className="mb-4 inline-block text-sm font-semibold text-brand-700 hover:underline">
          ← 評価表一覧に戻る
        </Link>
        {selected ? <EvaluationDetail key={selected.id} ev={selected} /> : <EmptyState>評価表が見つからないか、閲覧権限がありません。</EmptyState>}
      </PageContainer>
    );
  }

  const evaluators = staff.filter((s) => s.active && (s.isEvaluator || isAdminStaff(s)));

  return (
    <PageContainer>
      <PageHeader
        icon="⭐"
        title="人事評価"
        description="本人の自己評価 → 評価者の評価 → 確定 の流れで評価表を作成します。本人・評価者・管理者のみ閲覧できます。"
        actions={
          canCreate && (
            <button type="button" className={buttonClass.primary} onClick={() => setCreating(true)}>
              ＋ 評価表を作成
            </button>
          )
        }
      />

      {creating && (
        <Card className="mb-5 border-brand-300">
          <form onSubmit={create} className="space-y-4">
            <h2 className="text-sm font-bold text-slate-900">評価表を作成</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="評価期間" required>
                <select className={inputClass} value={newForm.period} onChange={(e) => setNewForm({ ...newForm, period: e.target.value })}>
                  {periodOptions().map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </Field>
              <Field label="評価者" required>
                <StaffSelect staff={evaluators} value={newForm.evaluatorId} onChange={(v) => setNewForm({ ...newForm, evaluatorId: v })} required />
              </Field>
            </div>
            <Field group label="対象者(複数選択可)" hint="同じ期間の評価表がすでにある人はスキップされます">
              <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-lg border border-slate-200 p-3">
                {staff
                  .filter((s) => s.active)
                  .map((s) => (
                    <label key={s.id} className="flex items-center gap-1.5 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-brand-600"
                        checked={newForm.staffIds.includes(s.id)}
                        onChange={(e) =>
                          setNewForm({
                            ...newForm,
                            staffIds: e.target.checked ? [...newForm.staffIds, s.id] : newForm.staffIds.filter((x) => x !== s.id),
                          })
                        }
                      />
                      {s.name}
                    </label>
                  ))}
              </div>
            </Field>
            <div className="flex gap-2">
              <button type="submit" className={buttonClass.primary} disabled={!newForm.staffIds.length || !newForm.evaluatorId}>
                作成する
              </button>
              <button type="button" className={buttonClass.secondary} onClick={() => setCreating(false)}>
                キャンセル
              </button>
            </div>
          </form>
        </Card>
      )}

      <div className="mb-3 flex items-center gap-2">
        <select className={`${inputClass} w-auto`} value={period} onChange={(e) => setPeriod(e.target.value)}>
          {[...new Set([...periodOptions(), ...visible.map((e) => e.period)])].map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <span className="text-xs text-slate-400">評価項目 {criteria.length}件(設定から変更可)</span>
      </div>

      {list.length === 0 ? (
        <EmptyState>{period} の評価表はありません。</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                {["対象者", "所属", "評価者", "状態", "自己平均", "評価者平均", "ランク", ""].map((h) => (
                  <th key={h} className="px-3 py-2 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((e) => {
                const s = staff.find((x) => x.id === e.staffId);
                const avg = evaluationAverages(e, criteria);
                return (
                  <tr key={e.id} className="cursor-pointer hover:bg-slate-50" onClick={() => router.push(`/portal/evaluations?id=${e.id}`)}>
                    <td className="px-3 py-2 font-semibold">{staffName(e.staffId)}</td>
                    <td className="px-3 py-2">{s && <UnitBadge unitId={s.unitId} />}</td>
                    <td className="px-3 py-2">{staffName(e.evaluatorId)}</td>
                    <td className="px-3 py-2">
                      <StatusPill tone={STATUS[e.status].tone}>{STATUS[e.status].label}</StatusPill>
                    </td>
                    <td className="px-3 py-2">{avg.self?.toFixed(1) ?? "-"}</td>
                    <td className="px-3 py-2">{avg.evaluator?.toFixed(1) ?? "-"}</td>
                    <td className="px-3 py-2 font-bold text-brand-700">{rankFromAverage(avg.evaluator)}</td>
                    <td className="px-3 py-2 text-right" onClick={(ev) => ev.stopPropagation()}>
                      {isAdmin && (
                        <button
                          type="button"
                          className={buttonClass.danger}
                          onClick={() => confirm(`${staffName(e.staffId)} さんの評価表を削除しますか?`) && collection("evaluations").remove(e.id)}
                        >
                          削除
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {current && !isAdmin && (
        <p className="mt-3 text-[11px] text-slate-400">
          {current.name}({unitName(current.unitId)})として表示中:自分が対象者・評価者の評価表のみ表示されます。
        </p>
      )}
    </PageContainer>
  );
}

export default function EvaluationsPage() {
  return (
    <Suspense fallback={null}>
      <EvaluationsInner />
    </Suspense>
  );
}
