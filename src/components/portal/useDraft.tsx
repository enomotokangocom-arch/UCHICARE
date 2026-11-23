"use client";

import { useEffect, useState } from "react";
import { CollectionKey, PortalData, usePortalStore } from "@/lib/portal/store";
import { buttonClass } from "./ui";

/** 未保存の変更があるとき、ページを離れる前に確認を出す */
export function useUnsavedWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}

type Item<K extends CollectionKey> = PortalData[K][number];

interface ListDraft<T> {
  patches: Record<string, Partial<T>>;
  removed: string[];
  addedStart: T[];
  addedEnd: T[];
  /** 「初期値に戻す」などで一覧ごと置き換える場合 */
  override: T[] | null;
}

const EMPTY = { patches: {}, removed: [], addedStart: [], addedEnd: [], override: null };

/**
 * 一覧の下書き。画面での変更(編集・追加・削除)は下書きに入り、「保存」を押したときだけ保存される。
 * 変更点だけを持つので、下書き中にほかの操作で一覧が増えても消えない。
 */
export function useDraftList<K extends CollectionKey>(key: K) {
  const source = usePortalStore((s) => s[key]) as Item<K>[];
  const replace = usePortalStore((s) => s.replaceCollection);
  const [draft, setDraft] = useState<ListDraft<Item<K>>>(EMPTY);
  const base = draft.override ?? source;
  const items = [
    ...draft.addedStart,
    ...base.filter((x) => !draft.removed.includes(x.id)).map((x) => (draft.patches[x.id] ? ({ ...x, ...draft.patches[x.id] } as Item<K>) : x)),
    ...draft.addedEnd,
  ];
  const dirty =
    draft.override !== null || draft.removed.length > 0 || draft.addedStart.length > 0 || draft.addedEnd.length > 0 || Object.keys(draft.patches).length > 0;
  useUnsavedWarning(dirty);
  const patchAdded = (list: Item<K>[], id: string, patch: Partial<Item<K>>) => list.map((x) => (x.id === id ? ({ ...x, ...patch } as Item<K>) : x));
  return {
    items,
    dirty,
    update: (id: string, patch: Partial<Item<K>>) =>
      setDraft((d) =>
        d.addedStart.some((x) => x.id === id) || d.addedEnd.some((x) => x.id === id)
          ? { ...d, addedStart: patchAdded(d.addedStart, id, patch), addedEnd: patchAdded(d.addedEnd, id, patch) }
          : { ...d, patches: { ...d.patches, [id]: { ...d.patches[id], ...patch } } }
      ),
    add: (item: Item<K>, atEnd = false) => setDraft((d) => (atEnd ? { ...d, addedEnd: [...d.addedEnd, item] } : { ...d, addedStart: [item, ...d.addedStart] })),
    remove: (id: string) =>
      setDraft((d) => ({
        ...d,
        addedStart: d.addedStart.filter((x) => x.id !== id),
        addedEnd: d.addedEnd.filter((x) => x.id !== id),
        removed: [...d.removed, id],
      })),
    setAll: (list: Item<K>[]) => setDraft({ ...EMPTY, override: list }),
    save: () => {
      if (dirty) replace(key, items as PortalData[K]);
      setDraft(EMPTY);
    },
    reset: () => setDraft(EMPTY),
  };
}

/** 1つの値(オブジェクト・数値など)の下書き */
export function useDraftValue<T>(value: T, onSave: (v: T) => void) {
  const [draft, setDraft] = useState<{ v: T } | null>(null);
  const dirty = draft !== null;
  useUnsavedWarning(dirty);
  return {
    value: draft ? draft.v : value,
    dirty,
    set: (v: T) => setDraft({ v }),
    patch: (p: Partial<T>) => setDraft((d) => ({ v: { ...(d ? d.v : value), ...p } as T })),
    save: () => {
      if (draft) onSave(draft.v);
      setDraft(null);
    },
    reset: () => setDraft(null),
  };
}

/** 「保存」「元に戻す」のバー。変更があるときだけ押せる */
export function SaveBar({ dirty, onSave, onReset, label = "保存する", sticky = true }: { dirty: boolean; onSave: () => void; onReset: () => void; label?: string; sticky?: boolean }) {
  const [saved, setSaved] = useState(false);
  return (
    <div
      className={`${sticky && dirty ? "sticky bottom-3 z-20" : ""} mt-4 flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 ${
        dirty ? "border border-amber-300 bg-amber-50 shadow-md" : "bg-transparent"
      }`}
    >
      {dirty && <span className="text-xs font-semibold text-amber-800">● 未保存の変更があります</span>}
      {saved && !dirty && <span className="text-xs font-semibold text-emerald-700">✓ 保存しました</span>}
      <span className="ml-auto flex gap-2">
        <button type="button" className={buttonClass.secondary} disabled={!dirty} onClick={onReset}>
          元に戻す
        </button>
        <button
          type="button"
          className={buttonClass.primary}
          disabled={!dirty}
          onClick={() => {
            onSave();
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
          }}
        >
          {label}
        </button>
      </span>
    </div>
  );
}
