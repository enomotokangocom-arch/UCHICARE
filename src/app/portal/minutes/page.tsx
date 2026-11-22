"use client";

import { FormEvent, useMemo, useState } from "react";
import { usePortalStore, useCurrentStaff, useStaffName } from "@/lib/portal/store";
import { committeeStatuses } from "@/lib/portal/logic";
import { Minutes } from "@/lib/portal/types";
import { formatDate, newId, nowIsoLocal, todayString } from "@/lib/portal/util";
import {
  Card,
  EmptyState,
  Field,
  PageContainer,
  PageHeader,
  StaffSelect,
  StatusPill,
  UnitBadges,
  buttonClass,
  inputClass,
} from "@/components/portal/ui";

type Form = Omit<Minutes, "id" | "createdAt">;

const STATE_LABEL = {
  ok: { tone: "ok", label: "開催済" },
  soon: { tone: "warn", label: "期限間近" },
  overdue: { tone: "danger", label: "期限超過" },
  never: { tone: "danger", label: "記録なし" },
  none: { tone: "neutral", label: "随時" },
} as const;

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

export default function MinutesPage() {
  const minutes = usePortalStore((s) => s.minutes);
  const committees = usePortalStore((s) => s.committees);
  const staff = usePortalStore((s) => s.staff);
  const collection = usePortalStore((s) => s.collection);
  const current = useCurrentStaff();
  const staffName = useStaffName();
  const activeStaff = staff.filter((s) => s.active);

  const blank = (committeeId = committees[0]?.id ?? ""): Form => ({
    committeeId,
    date: todayString(),
    startTime: "",
    endTime: "",
    place: "",
    attendeeIds: current ? [current.id] : [],
    otherAttendees: "",
    recorderId: current?.id ?? "",
    agenda: "",
    discussion: "",
    decisions: "",
    nextDate: "",
    attachmentUrl: "",
  });

  const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null);
  const [filter, setFilter] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const statuses = useMemo(() => committeeStatuses(committees, minutes), [committees, minutes]);
  const committeeName = (id: string) => committees.find((c) => c.id === id)?.name ?? "(削除済みの委員会)";

  const list = useMemo(
    () => minutes.filter((m) => !filter || m.committeeId === filter).sort((a, b) => b.date.localeCompare(a.date)),
    [minutes, filter]
  );

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    if (editing.id) collection("minutes").update(editing.id, editing.form);
    else collection("minutes").add({ ...editing.form, id: newId("m"), createdAt: nowIsoLocal() });
    setEditing(null);
  }

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    if (editing) setEditing({ ...editing, form: { ...editing.form, [key]: value } });
  }

  function printMinutes(m: Minutes) {
    const attendees = [...m.attendeeIds.map(staffName), m.otherAttendees].filter(Boolean).join("、");
    const row = (label: string, value: string) =>
      `<tr><th>${label}</th><td>${escapeHtml(value).replace(/\n/g, "<br>")}</td></tr>`;
    const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${escapeHtml(committeeName(m.committeeId))} 議事録 ${m.date}</title>
<style>body{font-family:sans-serif;padding:32px;color:#111}h1{font-size:20px;text-align:center;margin-bottom:4px}p.sub{text-align:center;color:#555;margin-top:0}
table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #999;padding:8px;font-size:13px;vertical-align:top;text-align:left}th{width:20%;background:#f3f3f3}</style></head><body>
<h1>${escapeHtml(committeeName(m.committeeId))} 議事録</h1><p class="sub">株式会社Uchi care</p><table>
${row("開催日時", `${formatDate(m.date)} ${m.startTime}〜${m.endTime}`)}
${row("開催場所", m.place)}${row("出席者", attendees)}${row("記録者", staffName(m.recorderId))}
${row("議題", m.agenda)}${row("協議内容", m.discussion)}${row("決定事項", m.decisions)}
${row("次回開催予定", m.nextDate ? formatDate(m.nextDate) : "")}${row("関連資料", m.attachmentUrl)}
</table></body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  }

  return (
    <PageContainer>
      <PageHeader
        icon="🗂️"
        title="委員会議事録"
        description="各委員会の議事録を作成・保管します。開催頻度の目安から次回の開催期限をお知らせします。"
        actions={
          <button
            type="button"
            className={buttonClass.primary}
            onClick={() => {
              setEditing({ id: null, form: blank(filter || undefined) });
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            ＋ 議事録を作成
          </button>
        }
      />

      {editing && (
        <Card className="mb-6 border-teal-300">
          <form onSubmit={submit} className="space-y-4">
            <h2 className="text-sm font-bold text-slate-900">{editing.id ? "議事録を編集" : "新しい議事録"}</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Field label="委員会" required className="col-span-2">
                <select className={inputClass} required value={editing.form.committeeId} onChange={(e) => set("committeeId", e.target.value)}>
                  {committees.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="開催日" required>
                <input type="date" className={inputClass} required value={editing.form.date} onChange={(e) => set("date", e.target.value)} />
              </Field>
              <Field label="開催場所">
                <input className={inputClass} value={editing.form.place} onChange={(e) => set("place", e.target.value)} />
              </Field>
              <Field label="開始">
                <input type="time" className={inputClass} value={editing.form.startTime} onChange={(e) => set("startTime", e.target.value)} />
              </Field>
              <Field label="終了">
                <input type="time" className={inputClass} value={editing.form.endTime} onChange={(e) => set("endTime", e.target.value)} />
              </Field>
              <Field label="記録者" className="col-span-2">
                <StaffSelect staff={activeStaff} value={editing.form.recorderId} onChange={(v) => set("recorderId", v)} />
              </Field>
            </div>
            <Field group label="出席者">
              <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-lg border border-slate-200 p-3">
                {activeStaff.map((s) => (
                  <label key={s.id} className="flex items-center gap-1.5 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-teal-600"
                      checked={editing.form.attendeeIds.includes(s.id)}
                      onChange={(e) =>
                        set(
                          "attendeeIds",
                          e.target.checked ? [...editing.form.attendeeIds, s.id] : editing.form.attendeeIds.filter((x) => x !== s.id)
                        )
                      }
                    />
                    {s.name}
                  </label>
                ))}
              </div>
            </Field>
            <Field label="その他の出席者(社外・オブザーバー等)">
              <input className={inputClass} value={editing.form.otherAttendees} onChange={(e) => set("otherAttendees", e.target.value)} />
            </Field>
            <Field label="議題" required>
              <textarea className={`${inputClass} min-h-20`} required value={editing.form.agenda} onChange={(e) => set("agenda", e.target.value)} />
            </Field>
            <Field label="協議内容">
              <textarea className={`${inputClass} min-h-28`} value={editing.form.discussion} onChange={(e) => set("discussion", e.target.value)} />
            </Field>
            <Field label="決定事項・今後の対応">
              <textarea className={`${inputClass} min-h-20`} value={editing.form.decisions} onChange={(e) => set("decisions", e.target.value)} />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="次回開催予定日">
                <input type="date" className={inputClass} value={editing.form.nextDate} onChange={(e) => set("nextDate", e.target.value)} />
              </Field>
              <Field label="関連資料のURL" hint="Googleドライブの資料・研修スライドなど">
                <input type="url" className={inputClass} value={editing.form.attachmentUrl} onChange={(e) => set("attachmentUrl", e.target.value)} />
              </Field>
            </div>
            <div className="flex gap-2">
              <button type="submit" className={buttonClass.primary}>
                保存する
              </button>
              <button type="button" className={buttonClass.secondary} onClick={() => setEditing(null)}>
                キャンセル
              </button>
            </div>
          </form>
        </Card>
      )}

      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">委員会の開催状況</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {statuses.map((s) => {
          const st = STATE_LABEL[s.state];
          return (
            <button
              key={s.committee.id}
              type="button"
              onClick={() => setFilter(filter === s.committee.id ? "" : s.committee.id)}
              className={`rounded-xl border bg-white p-3 text-left shadow-sm transition hover:border-teal-400 ${
                filter === s.committee.id ? "border-teal-500 ring-2 ring-teal-500/20" : "border-slate-200"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold text-slate-900">{s.committee.name}</p>
                <StatusPill tone={st.tone}>{st.label}</StatusPill>
              </div>
              <div className="mt-1">
                <UnitBadges units={s.committee.units} />
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                目安: {s.committee.frequencyMonths ? `${s.committee.frequencyMonths}ヶ月に1回` : "随時"} ・ 記録 {s.count}件
              </p>
              <p className="text-[11px] text-slate-500">
                最終開催: {s.lastDate ? formatDate(s.lastDate) : "-"}
                {s.nextDue && ` ・ 次回期限: ${formatDate(s.nextDue)}`}
              </p>
            </button>
          );
        })}
      </div>

      <div className="mt-8 mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-bold text-slate-900">議事録一覧{filter && `(${committeeName(filter)})`}</h2>
        {filter && (
          <button type="button" className={buttonClass.ghost} onClick={() => setFilter("")}>
            絞り込みを解除
          </button>
        )}
      </div>
      {list.length === 0 ? (
        <EmptyState>議事録はまだありません。</EmptyState>
      ) : (
        <div className="space-y-3">
          {list.map((m) => {
            const open = openId === m.id;
            return (
              <Card key={m.id}>
                <button type="button" className="flex w-full items-start justify-between gap-3 text-left" onClick={() => setOpenId(open ? null : m.id)}>
                  <span>
                    <span className="block text-sm font-bold text-slate-900">{committeeName(m.committeeId)}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {formatDate(m.date)} {m.startTime && `${m.startTime}〜${m.endTime}`} ・ 出席 {m.attendeeIds.length}名 ・ 記録者 {staffName(m.recorderId)}
                    </span>
                    {!open && <span className="mt-1 line-clamp-1 block text-xs text-slate-400">{m.agenda}</span>}
                  </span>
                  <span className="text-slate-400">{open ? "▲" : "▼"}</span>
                </button>
                {open && (
                  <div className="mt-4 space-y-3 border-t border-slate-100 pt-4 text-sm">
                    {[
                      ["開催場所", m.place],
                      ["出席者", [...m.attendeeIds.map(staffName), m.otherAttendees].filter(Boolean).join("、")],
                      ["議題", m.agenda],
                      ["協議内容", m.discussion],
                      ["決定事項・今後の対応", m.decisions],
                      ["次回開催予定", m.nextDate ? formatDate(m.nextDate) : ""],
                    ]
                      .filter(([, v]) => v)
                      .map(([label, v]) => (
                        <div key={label}>
                          <p className="text-xs font-semibold text-slate-500">{label}</p>
                          <p className="whitespace-pre-wrap text-slate-800">{v}</p>
                        </div>
                      ))}
                    {m.attachmentUrl && (
                      <a href={m.attachmentUrl} target="_blank" rel="noopener noreferrer" className="inline-block font-semibold text-teal-700 hover:underline">
                        📎 関連資料を開く ↗
                      </a>
                    )}
                    <div className="flex flex-wrap gap-2 pt-2">
                      <button type="button" className={buttonClass.secondary} onClick={() => printMinutes(m)}>
                        🖨 印刷・PDF保存
                      </button>
                      <button
                        type="button"
                        className={buttonClass.ghost}
                        onClick={() => {
                          // eslint-disable-next-line @typescript-eslint/no-unused-vars
                          const { id, createdAt, ...rest } = m;
                          setEditing({ id, form: rest });
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                      >
                        編集
                      </button>
                      <button
                        type="button"
                        className={buttonClass.danger}
                        onClick={() => confirm("この議事録を削除しますか?") && collection("minutes").remove(m.id)}
                      >
                        削除
                      </button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
