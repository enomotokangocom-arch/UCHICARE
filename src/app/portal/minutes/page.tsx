"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { usePortalStore, useCurrentStaff, useStaffName } from "@/lib/portal/store";
import { committeeStatuses } from "@/lib/portal/logic";
import { DriveFileRef, Minutes } from "@/lib/portal/types";
import { createGoogleDoc, ensureFolderPath, fileIcon, minutesFolderPath, toRef, uploadFile } from "@/lib/portal/googleDrive";
import { generateMinutes } from "@/lib/minutesClient";
import { MeetingRecorder, Recording } from "@/components/portal/MeetingRecorder";
import { DriveConnect } from "@/components/portal/DriveConnect";
import { useDrive } from "@/components/portal/useDrive";
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
    summary: "",
    transcript: "",
    attachments: [],
  });

  const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null);
  const [filter, setFilter] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [recording, setRecording] = useState<Recording | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [docBusyId, setDocBusyId] = useState<string | null>(null);
  const drive = useDrive();

  const statuses = useMemo(() => committeeStatuses(committees, minutes), [committees, minutes]);
  const committeeName = (id: string) => committees.find((c) => c.id === id)?.name ?? "(削除済みの委員会)";

  const list = useMemo(
    () => minutes.filter((m) => !filter || m.committeeId === filter).sort((a, b) => b.date.localeCompare(a.date)),
    [minutes, filter]
  );

  function startEditing(next: { id: string | null; form: Form }) {
    setEditing(next);
    setRecording(null);
    setFormError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /** 議事録の保存先フォルダ(委員会議事録/<委員会名>/<年度>)を用意する */
  async function minutesFolder(form: Pick<Form, "committeeId" | "date">) {
    return ensureFolderPath(drive.rootId, minutesFolderPath(committeeName(form.committeeId), form.date));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    let form = editing.form;
    setFormError(null);
    if (recording) {
      if (drive.ready) {
        try {
          setBusy("録音をGoogleドライブに保存しています...");
          const folderId = await minutesFolder(form);
          const name = `${form.date}_${committeeName(form.committeeId)}_録音.${recording.extension}`;
          const item = await uploadFile(recording.blob, name, folderId);
          form = { ...form, attachments: [...(form.attachments ?? []), toRef(item)] };
        } catch (err) {
          setBusy(null);
          setFormError(`録音の保存に失敗しました: ${err instanceof Error ? err.message : String(err)}`);
          return;
        } finally {
          setBusy(null);
        }
      } else if (!confirm("Googleドライブに接続していないため、録音は保存されません。必要なら「端末に保存」で保存してください。このまま議事録を保存しますか?")) {
        return;
      }
    }
    if (editing.id) collection("minutes").update(editing.id, form);
    else collection("minutes").add({ ...form, id: newId("m"), createdAt: nowIsoLocal() });
    setEditing(null);
    setRecording(null);
  }

  async function runAi() {
    if (!editing) return;
    const f = editing.form;
    if (!f.transcript?.trim()) {
      setFormError("先に録音するか、文字起こしのテキストを入力してください。");
      return;
    }
    const filled = [f.agenda, f.discussion, f.decisions, f.summary].some((v) => v?.trim());
    if (filled && !confirm("入力済みの議題・協議内容・決定事項・要約を、AIが作成した内容で置き換えます。よろしいですか?")) return;
    setFormError(null);
    setBusy("AIが議事録を作成しています(30秒ほどかかります)...");
    try {
      const result = await generateMinutes({
        transcript: f.transcript,
        committeeName: committeeName(f.committeeId),
        date: f.date,
        attendees: [...f.attendeeIds.map(staffName), f.otherAttendees].filter(Boolean),
        agendaHint: f.agenda,
      });
      setEditing((cur) =>
        cur
          ? {
              ...cur,
              form: {
                ...cur.form,
                summary: result.summary,
                agenda: result.agenda,
                discussion: result.discussion,
                decisions: result.decisions,
                nextDate: result.nextDate || cur.form.nextDate,
              },
            }
          : cur
      );
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function uploadAttachments(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!editing || !files.length) return;
    setFormError(null);
    try {
      const folderId = await minutesFolder(editing.form);
      const refs: DriveFileRef[] = [];
      for (const [i, f] of files.entries()) {
        setBusy(`アップロード中: ${f.name}(${i + 1}/${files.length})`);
        refs.push(toRef(await uploadFile(f, f.name, folderId)));
      }
      setEditing((cur) => (cur ? { ...cur, form: { ...cur.form, attachments: [...(cur.form.attachments ?? []), ...refs] } } : cur));
    } catch (err) {
      setFormError(`アップロードに失敗しました: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(null);
    }
  }

  async function saveAsGoogleDoc(m: Minutes) {
    setDocBusyId(m.id);
    try {
      const folderId = await minutesFolder(m);
      const doc = await createGoogleDoc(`${m.date} ${committeeName(m.committeeId)} 議事録`, minutesHtml(m), folderId);
      collection("minutes").update(m.id, { driveDocUrl: doc.webViewLink });
      window.open(doc.webViewLink, "_blank", "noopener");
    } catch (err) {
      alert(`Googleドキュメントへの保存に失敗しました: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDocBusyId(null);
    }
  }

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    if (editing) setEditing({ ...editing, form: { ...editing.form, [key]: value } });
  }

  function minutesHtml(m: Minutes) {
    const attendees = [...m.attendeeIds.map(staffName), m.otherAttendees].filter(Boolean).join("、");
    const row = (label: string, value: string) =>
      `<tr><th>${label}</th><td>${escapeHtml(value).replace(/\n/g, "<br>")}</td></tr>`;
    const attachments = (m.attachments ?? []).map((a) => `<a href="${escapeHtml(a.webViewLink)}">${escapeHtml(a.name)}</a>`).join("<br>");
    return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${escapeHtml(committeeName(m.committeeId))} 議事録 ${m.date}</title>
<style>body{font-family:sans-serif;padding:32px;color:#111}h1{font-size:20px;text-align:center;margin-bottom:4px}p.sub{text-align:center;color:#555;margin-top:0}
table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #999;padding:8px;font-size:13px;vertical-align:top;text-align:left}th{width:20%;background:#f3f3f3}</style></head><body>
<h1>${escapeHtml(committeeName(m.committeeId))} 議事録</h1><p class="sub">株式会社Uchi care</p><table>
${row("開催日時", `${formatDate(m.date)} ${m.startTime}〜${m.endTime}`)}
${row("開催場所", m.place)}${row("出席者", attendees)}${row("記録者", staffName(m.recorderId))}
${m.summary ? row("要約", m.summary) : ""}
${row("議題", m.agenda)}${row("協議内容", m.discussion)}${row("決定事項", m.decisions)}
${row("次回開催予定", m.nextDate ? formatDate(m.nextDate) : "")}${row("関連資料", m.attachmentUrl)}
${attachments ? `<tr><th>添付ファイル</th><td>${attachments}</td></tr>` : ""}
</table></body></html>`;
  }

  function printMinutes(m: Minutes) {
    const html = minutesHtml(m);
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
              startEditing({ id: null, form: blank(filter || undefined) });
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
            <section className="space-y-2 rounded-xl border border-violet-200 bg-violet-50/40 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-900">🎙 録音・文字起こし → ✨ AIで議事録を作成</h3>
                <button
                  type="button"
                  className={`${buttonClass.primary} bg-violet-600 hover:bg-violet-700`}
                  disabled={!!busy || !editing.form.transcript?.trim()}
                  onClick={runAi}
                >
                  ✨ AIで議事録を作成
                </button>
              </div>
              <MeetingRecorder
                transcript={editing.form.transcript ?? ""}
                onTranscriptChange={(t) => setEditing((cur) => (cur ? { ...cur, form: { ...cur.form, transcript: t } } : cur))}
                recording={recording}
                onRecording={setRecording}
              />
              <p className="text-[11px] text-slate-500">
                「AIで議事録を作成」を押すと、文字起こしをAI(Anthropic社のClaude)に送信し、要約・議題・協議内容・決定事項を作成して下の欄に入力します。利用者の氏名は「A様」などに置き換えるよう指示していますが、内容は必ず確認・修正してください。録音は保存時にGoogleドライブの議事録フォルダに保存されます。
              </p>
            </section>
            {busy && <p className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-700">⏳ {busy}</p>}
            {formError && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">⚠ {formError}</p>}
            <Field label="要約(AIが作成)">
              <textarea className={`${inputClass} min-h-20`} value={editing.form.summary ?? ""} onChange={(e) => set("summary", e.target.value)} />
            </Field>
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
            <Field group label="添付ファイル(作成済みの議事録・資料など)" hint="Googleドライブの「委員会議事録/委員会名/年度」フォルダに保存されます">
              <div className="space-y-2">
                {(editing.form.attachments ?? []).length > 0 && (
                  <ul className="space-y-1">
                    {(editing.form.attachments ?? []).map((a) => (
                      <li key={a.id} className="flex items-center gap-2 text-sm">
                        <span>{fileIcon(a.mimeType)}</span>
                        <a href={a.webViewLink} target="_blank" rel="noopener noreferrer" className="truncate text-teal-700 hover:underline">
                          {a.name}
                        </a>
                        <button
                          type="button"
                          className="text-xs text-slate-400 hover:text-rose-600"
                          title="一覧から外す(ドライブのファイルは残ります)"
                          onClick={() => set("attachments", (editing.form.attachments ?? []).filter((x) => x.id !== a.id))}
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {drive.ready ? (
                  <label className={`${buttonClass.secondary} cursor-pointer`}>
                    ⬆ ファイルをアップロード
                    <input type="file" multiple className="hidden" disabled={!!busy} onChange={uploadAttachments} />
                  </label>
                ) : (
                  <DriveConnect />
                )}
              </div>
            </Field>
            <div className="flex gap-2">
              <button type="submit" className={buttonClass.primary} disabled={!!busy}>
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
                      ["要約", m.summary ?? ""],
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
                    {(m.attachments ?? []).length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500">添付ファイル(Googleドライブ)</p>
                        <ul className="mt-1 space-y-1">
                          {(m.attachments ?? []).map((a) => (
                            <li key={a.id}>
                              <a href={a.webViewLink} target="_blank" rel="noopener noreferrer" className="text-teal-700 hover:underline">
                                {fileIcon(a.mimeType)} {a.name}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {m.transcript && (
                      <details className="text-xs text-slate-600">
                        <summary className="cursor-pointer font-semibold text-slate-500">文字起こしを表示</summary>
                        <p className="mt-1 max-h-60 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-2">{m.transcript}</p>
                      </details>
                    )}
                    {m.driveDocUrl && (
                      <a href={m.driveDocUrl} target="_blank" rel="noopener noreferrer" className="inline-block font-semibold text-teal-700 hover:underline">
                        📄 Googleドキュメント版を開く ↗
                      </a>
                    )}
                    <div className="flex flex-wrap gap-2 pt-2">
                      <button type="button" className={buttonClass.secondary} onClick={() => printMinutes(m)}>
                        🖨 印刷・PDF保存
                      </button>
                      {drive.ready && (
                        <button type="button" className={buttonClass.secondary} disabled={docBusyId === m.id} onClick={() => saveAsGoogleDoc(m)}>
                          {docBusyId === m.id ? "保存中..." : m.driveDocUrl ? "📄 Googleドキュメントに再保存" : "📄 Googleドキュメントに保存"}
                        </button>
                      )}
                      <button
                        type="button"
                        className={buttonClass.ghost}
                        onClick={() => {
                          // eslint-disable-next-line @typescript-eslint/no-unused-vars
                          const { id, createdAt, ...rest } = m;
                          startEditing({ id, form: rest });
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
