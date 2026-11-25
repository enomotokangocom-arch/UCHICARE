"use client";

import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { CollectionKey, PortalData, usePortalStore } from "./store";

/**
 * ポータルのデータを Supabase(portal_records)と同期する。
 *
 * - 読める記録・書ける記録はデータベース(security.sql の行レベルセキュリティ)が決める。
 *   ここでは「サーバーが返した記録だけを画面に出す」「変更をサーバーに送る」だけを行う。
 * - サーバーが保存を拒否したら(権限がないなど)、サーバーの内容を読み直して画面を元に戻す。
 */

export const SYNCED_COLLECTIONS: CollectionKey[] = [
  // 他の記録の持ち主・事業所を決めるのに使うため、職員・難病の患者を先に送る
  "staff",
  "nanbyoPatients",
  "links",
  "vehicles",
  "committees",
  "criteria",
  "notices",
  "vehicleLogs",
  "alcoholChecks",
  "minutes",
  "evaluations",
  "parkingLots",
  "parkingSpaces",
  "jobDescriptions",
  "nanbyoEntries",
  "salesActivities",
  "finance",
  "subsidies",
  "personalSales",
  "goals",
  "goalSheets",
  "consultationDesks",
  "dailySales",
  "feeRates",
  "staffCosts",
  "fixedCosts",
];

/** 一覧ではない設定値(settings に1件ずつ入れる) */
export const SYNCED_SETTINGS = [
  "philosophy",
  "goalSheetTemplates",
  "salesImportMappings",
  "regionUnitPrice",
  "profitSettings",
  "financeIsSample",
  "googleClientId",
  "driveRootFolderId",
] as const satisfies readonly (keyof PortalData)[];
type SettingKey = (typeof SYNCED_SETTINGS)[number];

/** サーバーへの移行が済んだことを示す印 */
const INITIALIZED_ID = "__initialized";

/** 「マスタだけ移す」ときに送る一覧 */
export const MASTER_COLLECTIONS: CollectionKey[] = [
  "staff",
  "links",
  "vehicles",
  "committees",
  "criteria",
  "parkingLots",
  "parkingSpaces",
  "jobDescriptions",
  "consultationDesks",
  "feeRates",
];

type SyncMode = "off" | "loading" | "local" | "server";

interface SyncState {
  /** off=未ログイン / local=サーバー未移行(この端末だけ) / server=サーバーと同期中 */
  mode: SyncMode;
  saving: number;
  error: string | null;
  lastLoadedAt: number;
}

export const useSync = create<SyncState>(() => ({ mode: "off", saving: 0, error: null, lastLoadedAt: 0 }));

interface Row {
  collection: string;
  id: string;
  data: Record<string, unknown> & { id: string };
  sort: number;
}

/** 記録ごとの並び順(サーバーの sort) */
const sorts = new Map<string, number>();
const sortKey = (c: string, id: string) => `${c}/${id}`;
/** サーバーから読み込んだ内容を反映している間は、変更をサーバーに送らない */
let applying = false;
let queue: Promise<unknown> = Promise.resolve();
let unsubscribe: (() => void) | null = null;

/** サーバーに送らずに画面のデータだけを変える */
export function applyLocal(fn: () => void) {
  applying = true;
  try {
    fn();
  } finally {
    applying = false;
  }
}

function errorMessage(e: { code?: string; message?: string } | null | undefined): string {
  if (!e) return "保存できませんでした";
  if (e.code === "42501" || /row-level security/i.test(e.message ?? "")) return "権限がないため保存できませんでした。";
  if (/Failed to fetch|NetworkError/i.test(e.message ?? "")) return "通信できないため保存できませんでした。通信環境を確認してください。";
  return `保存できませんでした: ${e.message ?? ""}`;
}

async function fetchAllRows(): Promise<Row[]> {
  const rows: Row[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase()
      .from("portal_records")
      .select("collection,id,data,sort")
      .order("collection")
      .order("sort")
      .order("id")
      .range(from, from + page - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as Row[]));
    if (!data || data.length < page) break;
  }
  return rows;
}

/** サーバーの内容を読み込んで画面に反映する。移行前なら false */
export async function loadFromServer(): Promise<boolean> {
  const rows = await fetchAllRows();
  const initialized = rows.some((r) => r.collection === "settings" && r.id === INITIALIZED_ID);
  if (!initialized) {
    useSync.setState({ mode: "local", lastLoadedAt: Date.now() });
    return false;
  }
  const patch: Record<string, unknown> = {};
  sorts.clear();
  for (const c of SYNCED_COLLECTIONS) patch[c] = [];
  for (const r of rows) {
    if (r.collection === "settings") {
      if ((SYNCED_SETTINGS as readonly string[]).includes(r.id)) patch[r.id] = (r.data as { value?: unknown }).value;
      continue;
    }
    sorts.set(sortKey(r.collection, r.id), r.sort);
    (patch[r.collection] as unknown[] | undefined)?.push(r.data);
  }
  applyLocal(() => usePortalStore.setState(patch as Partial<PortalData>));
  useSync.setState({ mode: "server", lastLoadedAt: Date.now() });
  return true;
}

function enqueue(task: () => Promise<void>) {
  useSync.setState((s) => ({ saving: s.saving + 1 }));
  queue = queue
    .then(task)
    .catch(async (e) => {
      useSync.setState({ error: errorMessage(e) });
      // サーバーの内容に戻す
      try {
        await loadFromServer();
      } catch {
        /* 読み直しに失敗しても次の操作で再試行される */
      }
    })
    .finally(() => useSync.setState((s) => ({ saving: s.saving - 1 })));
}

async function upsertRows(rows: Row[]) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase().from("portal_records").upsert(rows.slice(i, i + 500), { onConflict: "collection,id" });
    if (error) throw error;
  }
}

async function deleteRows(c: string, ids: string[]) {
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { error, count } = await supabase().from("portal_records").delete({ count: "exact" }).eq("collection", c).in("id", chunk);
    if (error) throw error;
    if ((count ?? 0) < chunk.length) throw { code: "42501", message: "row-level security" };
  }
}

type Item = { id: string } & Record<string, unknown>;

/** 並び順を決める。既存の並びが崩れていれば(並べ替え)すべて振り直す */
function assignSorts(c: string, items: Item[]): { values: number[]; renumbered: boolean } {
  const known = items.map((it) => sorts.get(sortKey(c, it.id)));
  let last = -Infinity;
  let ordered = true;
  for (const k of known) {
    if (k === undefined) continue;
    if (k <= last) {
      ordered = false;
      break;
    }
    last = k;
  }
  if (!ordered) return { values: items.map((_, i) => i), renumbered: true };
  const values = known.slice() as (number | undefined)[];
  for (let i = 0; i < values.length; i++) {
    if (values[i] !== undefined) continue;
    const prev = i > 0 ? values[i - 1] : undefined;
    let next: number | undefined;
    for (let j = i + 1; j < values.length; j++) {
      if (known[j] !== undefined) {
        next = known[j];
        break;
      }
    }
    values[i] = prev !== undefined && next !== undefined ? (prev + next) / 2 : prev !== undefined ? prev + 1 : next !== undefined ? next - 1 : i;
  }
  return { values: values as number[], renumbered: false };
}

const withoutReadBy = (n: Item) => {
  const copy = { ...n };
  delete copy.readBy;
  return JSON.stringify(copy);
};

function pushCollection(c: CollectionKey, before: Item[], after: Item[]) {
  const beforeMap = new Map(before.map((it) => [it.id, it]));
  const afterIds = new Set(after.map((it) => it.id));
  const removed = before.filter((it) => !afterIds.has(it.id)).map((it) => it.id);
  const { values, renumbered } = assignSorts(c, after);
  const upserts: Row[] = [];
  const readMarks: string[] = [];
  after.forEach((it, i) => {
    const prev = beforeMap.get(it.id);
    const changed = prev !== it;
    const sortChanged = sorts.get(sortKey(c, it.id)) !== values[i];
    if (!changed && !(renumbered && sortChanged)) return;
    // お知らせの既読だけが変わったときは、本人の既読を付ける専用の処理を使う
    if (c === "notices" && prev && changed && withoutReadBy(prev) === withoutReadBy(it) && !sortChanged) {
      readMarks.push(it.id);
      return;
    }
    upserts.push({ collection: c, id: it.id, data: it, sort: values[i] });
  });
  for (const r of upserts) sorts.set(sortKey(c, r.id), r.sort);
  for (const id of removed) sorts.delete(sortKey(c, id));
  if (upserts.length === 0 && removed.length === 0 && readMarks.length === 0) return;
  enqueue(async () => {
    if (upserts.length) await upsertRows(upserts);
    if (removed.length) await deleteRows(c, removed);
    for (const id of readMarks) {
      const { error } = await supabase().rpc("portal_mark_notice_read", { p_id: id });
      if (error) throw error;
    }
  });
}

function pushSetting(key: SettingKey, value: unknown) {
  enqueue(() => upsertRows([{ collection: "settings", id: key, data: { id: key, value } as Row["data"], sort: 0 }]));
}

/** 画面での変更をサーバーに送り始める */
function startPushing() {
  unsubscribe?.();
  unsubscribe = usePortalStore.subscribe((state, prev) => {
    if (applying || useSync.getState().mode !== "server") return;
    for (const c of SYNCED_COLLECTIONS) {
      if (state[c] !== prev[c]) pushCollection(c, prev[c] as unknown as Item[], state[c] as unknown as Item[]);
    }
    for (const k of SYNCED_SETTINGS) {
      if (state[k] !== prev[k]) pushSetting(k, state[k]);
    }
  });
}

/** ログイン後に呼ぶ。サーバーの内容を読み込み、以後の変更を同期する */
export async function startSync(): Promise<void> {
  useSync.setState({ mode: "loading", error: null });
  try {
    await loadFromServer();
  } catch (e) {
    // portal_records がない(security.sql 未実行)ときは、これまでどおりこの端末だけで使う
    const err = e as { code?: string; message?: string };
    if (err.code === "42P01" || err.code === "PGRST205" || /portal_records/.test(err.message ?? "")) {
      useSync.setState({ mode: "local" });
    } else {
      useSync.setState({ mode: "local", error: `サーバーのデータを読み込めませんでした(${err.message ?? ""})。この端末に保存されている内容を表示しています。` });
    }
  }
  startPushing();
}

export function stopSync() {
  unsubscribe?.();
  unsubscribe = null;
  sorts.clear();
  useSync.setState({ mode: "off", saving: 0, error: null, lastLoadedAt: 0 });
}

/** 画面に戻ってきたときなどに、他の職員の変更を読み込む */
export async function refreshFromServer(minIntervalMs = 60_000) {
  const s = useSync.getState();
  if (s.mode !== "server" || s.saving > 0 || Date.now() - s.lastLoadedAt < minIntervalMs) return;
  await queue;
  try {
    await loadFromServer();
  } catch {
    /* 通信できないときは次の機会に */
  }
}

/**
 * この端末のデータをサーバーに登録する(最初の1回・経営者/統括部長のみ)。
 * mode="master" は職員・リンク・車両などのマスタと設定だけを登録し、記録(売上・運行記録など)は空で始める。
 */
export async function uploadLocalToServer(mode: "all" | "master"): Promise<void> {
  const state = usePortalStore.getState();
  const collections = mode === "all" ? SYNCED_COLLECTIONS : MASTER_COLLECTIONS;
  const settings: Row[] = SYNCED_SETTINGS.filter((k) => mode === "all" || k !== "financeIsSample").map((k) => ({
    collection: "settings",
    id: k,
    data: { id: k, value: state[k] } as Row["data"],
    sort: 0,
  }));
  if (mode === "master") settings.push({ collection: "settings", id: "financeIsSample", data: { id: "financeIsSample", value: false } as Row["data"], sort: 0 });
  await upsertRows(settings);
  for (const c of collections) {
    const items = state[c] as unknown as Item[];
    await upsertRows(items.map((it, i) => ({ collection: c, id: it.id, data: it, sort: i })));
  }
  await upsertRows([{ collection: "settings", id: INITIALIZED_ID, data: { id: INITIALIZED_ID, value: new Date().toISOString() } as Row["data"], sort: 0 }]);
  await loadFromServer();
}

/** この端末に残っているポータルのデータを消す(ログアウト時。共用の端末に情報を残さない) */
export function clearLocalData() {
  stopSync();
  try {
    localStorage.removeItem("uchicare-portal");
    sessionStorage.clear();
  } catch {
    /* ストレージが使えない環境 */
  }
}
