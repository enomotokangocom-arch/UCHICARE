"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePortalStore, useCurrentStaff, useStaffName } from "@/lib/portal/store";
import { noticeVisibleTo, sortNotices } from "@/lib/portal/logic";
import { isAdmin } from "@/lib/portal/logic";
import { BusinessUnitId, Notice, NoticeCategory } from "@/lib/portal/types";
import { formatDateTime, newId, nowIsoLocal } from "@/lib/portal/util";
import {
  Card,
  EmptyState,
  Field,
  PageContainer,
  PageHeader,
  StatusPill,
  UnitBadges,
  UnitCheckboxes,
  UnitFilter,
  buttonClass,
  inputClass,
} from "@/components/portal/ui";

const CATEGORIES: NoticeCategory[] = ["お知らせ", "重要", "研修", "行事", "規程・制度", "システム"];

type Form = { title: string; body: string; category: NoticeCategory; units: BusinessUnitId[]; pinned: boolean; linkUrl: string };
const EMPTY: Form = { title: "", body: "", category: "お知らせ", units: [], pinned: false, linkUrl: "" };

function NoticesInner() {
  const notices = usePortalStore((s) => s.notices);
  const staff = usePortalStore((s) => s.staff);
  const collection = usePortalStore((s) => s.collection);
  const markNoticeRead = usePortalStore((s) => s.markNoticeRead);
  const current = useCurrentStaff();
  const staffName = useStaffName();
  const router = useRouter();
  const searchParams = useSearchParams();
  const openId = searchParams.get("id");

  const [unit, setUnit] = useState<BusinessUnitId | "all">("all");
  const [onlyMine, setOnlyMine] = useState(true);
  const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null);

  const list = useMemo(() => {
    return sortNotices(
      notices.filter(
        (n) =>
          (!onlyMine || noticeVisibleTo(n, current)) &&
          (unit === "all" || n.units.length === 0 || n.units.includes(unit))
      )
    );
  }, [notices, onlyMine, current, unit]);

  useEffect(() => {
    if (openId && current) markNoticeRead(openId, current.id);
  }, [openId, current, markNoticeRead]);

  const canEdit = (n: Notice) => current && (n.authorId === current.id || isAdmin(current));
  const activeStaff = staff.filter((s) => s.active);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!editing || !current) return;
    const { id, form } = editing;
    if (id) {
      collection("notices").update(id, form);
    } else {
      collection("notices").add({
        ...form,
        id: newId("n"),
        authorId: current.id,
        createdAt: nowIsoLocal(),
        readBy: [current.id],
      });
    }
    setEditing(null);
  }

  return (
    <PageContainer>
      <PageHeader
        icon="📢"
        title="社内のお知らせ"
        description="全社・事業所ごとのお知らせを掲示します。開くと既読になり、既読者を確認できます。"
        actions={
          <button type="button" className={buttonClass.primary} onClick={() => setEditing({ id: null, form: EMPTY })}>
            ＋ お知らせを作成
          </button>
        }
      />

      {editing && (
        <Card className="mb-5 border-teal-300">
          <form onSubmit={submit} className="space-y-4">
            <h2 className="text-sm font-bold text-slate-900">{editing.id ? "お知らせを編集" : "新しいお知らせ"}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="タイトル" required className="sm:col-span-2">
                <input
                  className={inputClass}
                  required
                  value={editing.form.title}
                  onChange={(e) => setEditing({ ...editing, form: { ...editing.form, title: e.target.value } })}
                />
              </Field>
              <Field label="カテゴリ">
                <select
                  className={inputClass}
                  value={editing.form.category}
                  onChange={(e) =>
                    setEditing({ ...editing, form: { ...editing.form, category: e.target.value as NoticeCategory } })
                  }
                >
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="本文" required>
              <textarea
                className={`${inputClass} min-h-32`}
                required
                value={editing.form.body}
                onChange={(e) => setEditing({ ...editing, form: { ...editing.form, body: e.target.value } })}
              />
            </Field>
            <Field label="関連資料のURL" hint="Googleドキュメント・スプレッドシート・フォームなどのリンクを添付できます">
              <input
                type="url"
                className={inputClass}
                placeholder="https://docs.google.com/..."
                value={editing.form.linkUrl}
                onChange={(e) => setEditing({ ...editing, form: { ...editing.form, linkUrl: e.target.value } })}
              />
            </Field>
            <Field group label="対象の事業所" hint="何も選ばない場合は全社向けになります">
              <UnitCheckboxes
                value={editing.form.units}
                onChange={(units) => setEditing({ ...editing, form: { ...editing.form, units } })}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 accent-teal-600"
                checked={editing.form.pinned}
                onChange={(e) => setEditing({ ...editing, form: { ...editing.form, pinned: e.target.checked } })}
              />
              📌 一覧の先頭に固定する
            </label>
            <div className="flex gap-2">
              <button type="submit" className={buttonClass.primary}>
                {editing.id ? "保存する" : "掲示する"}
              </button>
              <button type="button" className={buttonClass.secondary} onClick={() => setEditing(null)}>
                キャンセル
              </button>
            </div>
          </form>
        </Card>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <UnitFilter value={unit} onChange={setUnit} />
        <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
          <input type="checkbox" className="h-4 w-4 accent-teal-600" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
          自分の所属向けのみ表示
        </label>
      </div>

      {list.length === 0 ? (
        <EmptyState>お知らせはありません。</EmptyState>
      ) : (
        <div className="space-y-3">
          {list.map((n) => {
            const open = openId === n.id;
            const unread = current && !n.readBy.includes(current.id);
            const targetStaff = activeStaff.filter((s) => n.units.length === 0 || n.units.includes(s.unitId));
            const readers = targetStaff.filter((s) => n.readBy.includes(s.id));
            return (
              <Card key={n.id} className={open ? "border-teal-300" : ""}>
                <button
                  type="button"
                  className="flex w-full items-start gap-3 text-left"
                  onClick={() => router.replace(open ? "/portal/notices" : `/portal/notices?id=${n.id}`, { scroll: false })}
                >
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${unread ? "bg-rose-500" : "bg-transparent"}`} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      {n.pinned && <span>📌</span>}
                      <StatusPill tone={n.category === "重要" ? "danger" : "neutral"}>{n.category}</StatusPill>
                      <UnitBadges units={n.units} />
                    </span>
                    <span className={`mt-1 block text-sm sm:text-base ${unread ? "font-bold" : "font-semibold"} text-slate-900`}>
                      {n.title}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-slate-400">
                      {formatDateTime(n.createdAt)} ・ {staffName(n.authorId)} ・ 既読 {readers.length}/{targetStaff.length}名
                    </span>
                  </span>
                  <span className="text-slate-400">{open ? "▲" : "▼"}</span>
                </button>
                {open && (
                  <div className="mt-4 border-t border-slate-100 pt-4 pl-5">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{n.body}</p>
                    {n.linkUrl && (
                      <a
                        href={n.linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-block text-sm font-semibold text-teal-700 hover:underline"
                      >
                        📎 関連資料を開く ↗
                      </a>
                    )}
                    <details className="mt-4 text-xs text-slate-500">
                      <summary className="cursor-pointer font-semibold">既読状況を見る</summary>
                      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <p>
                          <span className="font-semibold text-emerald-700">既読:</span>{" "}
                          {readers.map((s) => s.name).join("、") || "なし"}
                        </p>
                        <p>
                          <span className="font-semibold text-rose-600">未読:</span>{" "}
                          {targetStaff.filter((s) => !n.readBy.includes(s.id)).map((s) => s.name).join("、") || "なし"}
                        </p>
                      </div>
                    </details>
                    {canEdit(n) && (
                      <div className="mt-4 flex gap-2">
                        <button
                          type="button"
                          className={buttonClass.ghost}
                          onClick={() => {
                            setEditing({
                              id: n.id,
                              form: { title: n.title, body: n.body, category: n.category, units: n.units, pinned: n.pinned, linkUrl: n.linkUrl },
                            });
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                        >
                          編集
                        </button>
                        <button
                          type="button"
                          className={buttonClass.danger}
                          onClick={() => {
                            if (confirm("このお知らせを削除しますか?")) {
                              collection("notices").remove(n.id);
                              router.replace("/portal/notices");
                            }
                          }}
                        >
                          削除
                        </button>
                      </div>
                    )}
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

export default function NoticesPage() {
  return (
    <Suspense fallback={null}>
      <NoticesInner />
    </Suspense>
  );
}
