"use client";

import { useState } from "react";
import clsx from "clsx";
import { usePortalStore, useCurrentStaff } from "@/lib/portal/store";
import { isAdmin } from "@/lib/portal/logic";
import { ConsultationDesk } from "@/lib/portal/types";
import { formatDateTime, nowIsoLocal } from "@/lib/portal/util";
import { assistResponder, organizeConsultation } from "@/lib/consultationClient";
import { IntakeResult, ResponderResult } from "@/lib/consultationTypes";
import { createGoogleDoc, ensureFolderPath } from "@/lib/portal/googleDrive";
import { useDrive } from "@/components/portal/useDrive";
import { Card, Field, PageContainer, PageHeader, StatusPill, buttonClass, inputClass } from "@/components/portal/ui";

const WISH_OPTIONS = ["まずは話を聞いてほしい", "面談で相談したい", "電話で話したい", "メールで返事がほしい", "早めに対応してほしい"];
const RECORD_FOLDER = "相談窓口記録";

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

function CopyButton({ text, label = "コピー" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={buttonClass.ghost}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? "✓ コピーしました" : `📋 ${label}`}
    </button>
  );
}

function SafetyNotice() {
  return (
    <div className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">
      <p className="font-bold">身の安全に関わる場合は、すぐに助けを求めてください。</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
        <li>危険が迫っているとき: 警察 110 / 救急 119</li>
        <li>つらい気持ちを今すぐ話したいとき: よりそいホットライン 0120-279-338(24時間・無料)</li>
        <li>社外の労働相談: 各都道府県労働局の「総合労働相談コーナー」</li>
      </ul>
    </div>
  );
}

function DeskCard({ desk, selected, onSelect }: { desk: ConsultationDesk; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={clsx(
        "flex w-full items-start gap-3 rounded-xl border bg-white p-4 text-left shadow-sm transition",
        selected ? "border-brand-600 ring-2 ring-brand-600/20" : "border-slate-200 hover:border-brand-300"
      )}
    >
      <span className="text-2xl">{desk.icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-bold text-brand-700">{desk.name}</span>
        <span className="block text-xs font-semibold text-gold-700">
          担当: {desk.owner}
          {desk.phone && <span className="ml-2 font-normal text-slate-500">📞 {desk.phone}</span>}
        </span>
        <span className="mt-1 block text-xs leading-relaxed text-slate-500">{desk.description}</span>
      </span>
    </button>
  );
}

function ConsultForm({ desks }: { desks: ConsultationDesk[] }) {
  const current = useCurrentStaff();
  const [deskId, setDeskId] = useState(desks[0]?.id ?? "");
  const [anonymous, setAnonymous] = useState(false);
  const [wishes, setWishes] = useState<string[]>(["まずは話を聞いてほしい"]);
  const [text, setText] = useState("");
  const [result, setResult] = useState<IntakeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState<string | null>(null);
  const desk = desks.find((d) => d.id === deskId);

  async function organize() {
    if (!desk) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await organizeConsultation(desk.name, text, wishes.join("、")));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  // 送信のタイミングの日時を自動で入れる
  function buildMessage(at: string) {
    if (!desk) return { subject: "", body: "" };
    const who = anonymous ? "匿名を希望" : current ? `${current.name}` : "(未選択)";
    const subject = `【相談窓口:${desk.name}】${result?.title ?? "ご相談"}(${formatDateTime(at)})`;
    const lines = [
      `${desk.owner} 様`,
      "",
      `相談窓口: ${desk.name}`,
      `相談日時: ${formatDateTime(at)}(自動入力)`,
      `相談者: ${who}`,
      `希望する対応: ${wishes.join("、") || "特になし"}`,
    ];
    if (result) {
      lines.push(
        `緊急度(AIによる目安): ${result.urgency}${result.safetyConcern ? "(身の安全に関わる可能性あり)" : ""}`,
        "",
        "■ 相談の要点(AIで整理)",
        result.summary,
        "",
        "■ 経緯",
        result.timeline,
        "",
        "■ 相談者の希望",
        result.requests
      );
    }
    lines.push("", "■ 相談者が書いた内容(原文)", text.trim(), "", "※このメールは Uchi care 社内ポータルの相談窓口から作成されました。");
    return { subject, body: lines.join("\n") };
  }

  function sendMail() {
    if (!desk?.email) return;
    const at = nowIsoLocal();
    const { subject, body } = buildMessage(at);
    window.location.href = `mailto:${encodeURIComponent(desk.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setSentAt(at);
  }

  async function sendForm() {
    if (!desk?.formUrl) return;
    const at = nowIsoLocal();
    const { subject, body } = buildMessage(at);
    await navigator.clipboard.writeText(`${subject}\n\n${body}`).catch(() => undefined);
    window.open(desk.formUrl, "_blank", "noopener");
    setSentAt(at);
  }

  if (!desk) return <p className="text-sm text-slate-400">相談窓口が設定されていません。</p>;
  const preview = buildMessage(nowIsoLocal());

  return (
    <div className="space-y-5">
      <section>
        <h2 className="mb-2 text-sm font-bold text-slate-900">① 相談する窓口を選ぶ</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {desks.map((d) => (
            <DeskCard
              key={d.id}
              desk={d}
              selected={d.id === deskId}
              onSelect={() => {
                setDeskId(d.id);
                setResult(null);
                setSentAt(null);
              }}
            />
          ))}
        </div>
      </section>

      <Card>
        <h2 className="mb-3 text-sm font-bold text-slate-900">② 相談内容を書く</h2>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span className="text-xs text-slate-500">
              相談日時: <span className="font-semibold text-slate-700">送信した日時が自動で入ります</span>
            </span>
            <label className="flex items-center gap-2">
              <input type="radio" className="h-4 w-4 accent-brand-600" checked={!anonymous} onChange={() => setAnonymous(false)} />
              名前を伝える{current ? `(${current.name})` : ""}
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" className="h-4 w-4 accent-brand-600" checked={anonymous} onChange={() => setAnonymous(true)} />
              匿名で相談する
            </label>
          </div>
          <Field group label="希望する対応(複数選べます)">
            <div className="flex flex-wrap gap-2">
              {WISH_OPTIONS.map((w) => {
                const on = wishes.includes(w);
                return (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setWishes(on ? wishes.filter((x) => x !== w) : [...wishes, w])}
                    className={clsx(
                      "rounded-full px-3 py-1.5 text-xs font-semibold ring-1",
                      on ? "bg-brand-700 text-white ring-brand-700" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
                    )}
                  >
                    {on ? "✓ " : ""}
                    {w}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label="相談内容" hint="うまくまとまっていなくても大丈夫です。AIが整理します。">
            <textarea
              className={`${inputClass} min-h-40`}
              placeholder={"例)いつ・どこで・誰に・何があったか、どう感じているか、どうしてほしいか など"}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setSentAt(null);
              }}
            />
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={`${buttonClass.primary} bg-violet-600 hover:bg-violet-700`} disabled={busy || !text.trim()} onClick={organize}>
              {busy ? "AIが整理しています..." : "✨ AIで内容を整理する"}
            </button>
            <span className="text-[11px] text-slate-400">整理のため、相談内容はAI(Anthropic社のClaude)に送られます。アプリには保存されません。</span>
          </div>
          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">⚠ {error}</p>}
        </div>
      </Card>

      {result && (
        <Card className="border-violet-200">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900">AIが整理した内容</h2>
            <StatusPill tone={result.urgency === "高" ? "danger" : result.urgency === "中" ? "warn" : "neutral"}>緊急度の目安: {result.urgency}</StatusPill>
          </div>
          {result.safetyConcern && (
            <div className="mt-3">
              <SafetyNotice />
            </div>
          )}
          <p className="mt-3 rounded-lg bg-violet-50 p-3 text-sm leading-relaxed text-violet-900">{result.messageToConsulter}</p>
          <dl className="mt-3 space-y-3 text-sm">
            {(
              [
                ["件名", result.title],
                ["要点", result.summary],
                ["経緯", result.timeline],
                ["希望", result.requests],
              ] as const
            ).map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs font-bold text-slate-500">{k}</dt>
                <dd className="whitespace-pre-wrap text-slate-800">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-[11px] text-slate-400">内容が違う場合は、相談内容を直してもう一度整理するか、そのまま送ってください(原文も一緒に届きます)。</p>
        </Card>
      )}

      <Card>
        <h2 className="mb-2 text-sm font-bold text-slate-900">③ {desk.owner} さんに送る</h2>
        <div className="flex flex-wrap gap-2">
          {desk.email ? (
            <button type="button" className={buttonClass.primary} disabled={!text.trim()} onClick={sendMail}>
              ✉ メールで送る
            </button>
          ) : (
            <span className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">この窓口のメールアドレスが未設定です(「設定・マスタ」→「相談窓口」で設定)。</span>
          )}
          {desk.formUrl && (
            <button type="button" className={buttonClass.secondary} disabled={!text.trim()} onClick={sendForm}>
              📝 Googleフォームで送る(内容をコピーして開く)
            </button>
          )}
          {desk.phone && (
            <a href={`tel:${desk.phone.replace(/[^0-9+]/g, "")}`} className={buttonClass.secondary}>
              📞 電話で相談する({desk.phone})
            </a>
          )}
          <CopyButton text={`${preview.subject}\n\n${preview.body}`} label="送る内容をコピー" />
        </div>
        {anonymous && desk.email && (
          <p className="mt-2 text-xs text-amber-700">
            ※メールで送ると、送信元のメールアドレスで相談者がわかります。完全に匿名にしたい場合は{desk.formUrl ? "Googleフォーム" : "Googleフォーム(担当者が設定)"}をお使いください。
          </p>
        )}
        {sentAt && (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {formatDateTime(sentAt)} に送信の画面を開きました。メールアプリ・フォームで送信が完了しているか確認してください。担当の{desk.owner}さんから連絡があります。
          </p>
        )}
        <details className="mt-3 text-xs text-slate-500">
          <summary className="cursor-pointer font-semibold">送る内容を確認する</summary>
          <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-sans text-slate-700">{`${preview.subject}\n\n${preview.body}`}</pre>
        </details>
      </Card>
    </div>
  );
}

function ResponderTool({ desks }: { desks: ConsultationDesk[] }) {
  const drive = useDrive();
  const [deskId, setDeskId] = useState(desks[0]?.id ?? "");
  const [text, setText] = useState("");
  const [memo, setMemo] = useState("");
  const [result, setResult] = useState<ResponderResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const desk = desks.find((d) => d.id === deskId);

  async function run() {
    if (!desk) return;
    setBusy("AIが対応を整理しています...");
    setMessage(null);
    try {
      setResult(await assistResponder(desk.name, text));
    } catch (e) {
      setMessage(`⚠ ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  }

  async function saveRecord() {
    if (!desk) return;
    setBusy("Googleドライブに記録を保存しています...");
    setMessage(null);
    try {
      const at = nowIsoLocal();
      const section = (title: string, body: string) => `<h3>${escapeHtml(title)}</h3><p>${escapeHtml(body).replace(/\n/g, "<br>")}</p>`;
      const html = `<html><body><h2>${escapeHtml(desk.name)} 対応記録</h2><p>記録日時: ${formatDateTime(at)} / 担当: ${escapeHtml(desk.owner)}</p>
${section("受け取った相談", text)}${result ? section("要点", result.keyPoints) + section("配慮が必要な点", result.risks) + section("次の対応", result.nextSteps) + section("返信文の下書き", result.replyDraft) : ""}${section("担当者メモ", memo)}</body></html>`;
      const folderId = await ensureFolderPath(drive.rootId, [RECORD_FOLDER, desk.name]);
      const doc = await createGoogleDoc(`${at.slice(0, 10)} ${desk.name} 対応記録`, html, folderId);
      setMessage(`Googleドキュメントに保存しました。`);
      window.open(doc.webViewLink, "_blank", "noopener");
    } catch (e) {
      setMessage(`⚠ ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="窓口">
            <select className={inputClass} value={deskId} onChange={(e) => setDeskId(e.target.value)}>
              {desks.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}(担当: {d.owner})
                </option>
              ))}
            </select>
          </Field>
          <p className="text-xs text-slate-500 md:col-span-2 md:pt-6">
            メールやフォームで届いた相談を貼り付けると、AIが要点・配慮点・次の対応・返信文の下書きをまとめます。判断と対応は担当者が行ってください。
          </p>
        </div>
        <Field label="受け取った相談" className="mt-3">
          <textarea className={`${inputClass} min-h-40`} value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
        <button type="button" className={`${buttonClass.primary} mt-3 bg-violet-600 hover:bg-violet-700`} disabled={!!busy || !text.trim()} onClick={run}>
          ✨ AIで対応を整理する
        </button>
      </Card>

      {result && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {(
            [
              ["要点・確認が必要なこと", result.keyPoints],
              ["配慮が必要な点", result.risks],
              ["次の対応", result.nextSteps],
              ["返信文の下書き", result.replyDraft],
            ] as const
          ).map(([title, body]) => (
            <Card key={title}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-900">{title}</h3>
                <CopyButton text={body} />
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{body}</p>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <Field label="担当者メモ(対応の経過など)">
          <textarea className={`${inputClass} min-h-24`} value={memo} onChange={(e) => setMemo(e.target.value)} />
        </Field>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {drive.ready ? (
            <button type="button" className={buttonClass.secondary} disabled={!!busy || !text.trim()} onClick={saveRecord}>
              📄 対応記録をGoogleドキュメントに保存
            </button>
          ) : (
            <span className="text-xs text-slate-500">Googleドライブに接続すると、対応記録を保存できます(「書類フォルダ」画面から接続)。</span>
          )}
        </div>
        <p className="mt-2 text-[11px] text-amber-700">
          ※記録は「{RECORD_FOLDER}/窓口名」フォルダに保存されます。このフォルダは担当者と管理者だけが見られるよう、Googleドライブで共有範囲を制限してください。
        </p>
      </Card>
      {busy && <p className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-700">⏳ {busy}</p>}
      {message && <p className={`rounded-lg px-3 py-2 text-sm ${message.startsWith("⚠") ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>{message}</p>}
    </div>
  );
}

export default function ConsultationPage() {
  const desks = usePortalStore((s) => s.consultationDesks);
  const current = useCurrentStaff();
  // 担当者向けの画面は、窓口の担当者(名前が一致する職員)と管理者のみ
  const isOwner = !!current && desks.some((d) => d.owner && current.name.includes(d.owner));
  const canRespond = isAdmin(current) || isOwner;
  const [tab, setTab] = useState<"consult" | "respond">("consult");

  return (
    <PageContainer>
      <PageHeader
        icon="💬"
        title="相談窓口"
        description="困ったことは一人で抱えず、相談してください。相談内容は担当者にだけ届き、アプリには保存されません。"
      />
      {canRespond && (
        <div className="mb-5 flex gap-1 border-b border-slate-200">
          {(
            [
              ["consult", "相談する"],
              ["respond", "担当者向け(相談への対応)"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={clsx("-mb-px border-b-2 px-4 py-2 text-sm font-semibold", tab === id ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800")}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {tab === "respond" && canRespond ? <ResponderTool desks={desks} /> : <ConsultForm desks={desks} />}
    </PageContainer>
  );
}
