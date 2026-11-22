/**
 * Googleドライブ連携(ブラウザから Drive API を直接呼ぶ)。
 *
 * - ログインは Google Identity Services のトークンクライアントで行う。アクセストークンは
 *   ページの再読み込みで切れないよう sessionStorage(そのタブの中だけ)に保持し、localStorage には保存しない。
 *   期限は約1時間で、切れたら再ログイン。
 * - スコープは共有フォルダ・共有ドライブの書類を扱えるよう drive を使う。
 *   Google Cloud の OAuth 同意画面を「内部」にすれば、社内アカウントだけが利用できる。
 */
import { create } from "zustand";
import { DriveFileRef } from "./types";

const GIS_SRC = "https://accounts.google.com/gsi/client";
const API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
export const FOLDER_MIME = "application/vnd.google-apps.folder";

/** アプリが作る標準フォルダ */
export const STANDARD_FOLDERS = ["委員会議事録", "運行管理・アルコールチェック", "人事評価", "研修資料", "規程・マニュアル", "営業資料", "経営資料"];
export const MINUTES_FOLDER = "委員会議事録";

export interface DriveItem extends DriveFileRef {
  modifiedTime?: string;
  size?: string;
}

// ---- Google Identity Services の最小限の型 ----
interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}
interface TokenClient {
  requestAccessToken: (overrides?: { prompt?: string }) => void;
}
interface GoogleOAuth2 {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    callback: (resp: TokenResponse) => void;
    error_callback?: (err: { type: string; message?: string }) => void;
  }) => TokenClient;
  revoke: (token: string, done?: () => void) => void;
}
declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleOAuth2 } };
  }
}

interface DriveAuthState {
  token: string | null;
  expiresAt: number;
  connecting: boolean;
  error: string | null;
}

const SESSION_KEY = "uchicare-drive-token";

function restoreToken(): { token: string | null; expiresAt: number } {
  try {
    const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "null") as { token: string; expiresAt: number } | null;
    if (saved && saved.expiresAt > Date.now()) return saved;
  } catch {
    /* sessionStorage が使えない環境では復元しない */
  }
  return { token: null, expiresAt: 0 };
}

export const useDriveAuth = create<DriveAuthState>(() => ({
  ...(typeof window === "undefined" ? { token: null, expiresAt: 0 } : restoreToken()),
  connecting: false,
  error: null,
}));

let expiryTimer: ReturnType<typeof setTimeout> | null = null;

function setToken(token: string | null, expiresAt = 0) {
  useDriveAuth.setState({ token, expiresAt });
  if (expiryTimer) clearTimeout(expiryTimer);
  try {
    if (token) sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token, expiresAt }));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* 保存できなくても接続自体は続ける */
  }
  if (token) expiryTimer = setTimeout(() => setToken(null), Math.max(0, expiresAt - Date.now()));
}

if (typeof window !== "undefined") {
  const { token, expiresAt } = useDriveAuth.getState();
  if (token) setToken(token, expiresAt);
}

export function isDriveConnected(): boolean {
  const { token, expiresAt } = useDriveAuth.getState();
  return !!token && Date.now() < expiresAt;
}

let gisLoading: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (!gisLoading) {
    gisLoading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = GIS_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        gisLoading = null;
        reject(new Error("Googleのログイン用スクリプトを読み込めませんでした。"));
      };
      document.head.appendChild(script);
    });
  }
  return gisLoading;
}

/** ログイン時のエラーを、原因と対処がわかる日本語にする */
function loginErrorMessage(code?: string, detail?: string): string {
  switch (code) {
    case "popup_failed_to_open":
      return "Googleのログイン画面(ポップアップ)が開けませんでした。ブラウザの設定でこのサイトのポップアップを許可してから、もう一度お試しください。";
    case "popup_closed":
      return "ログイン画面が閉じられました。もう一度「Googleでログインして接続」を押してください。";
    case "access_denied":
      return "Googleドライブへのアクセスが許可されませんでした。ログイン画面で「許可」を押すか、OAuth 同意画面の「対象」(内部/テストユーザー)を確認してください。";
    default:
      return `Googleへのログインに失敗しました(${code ?? "不明なエラー"}${detail ? `: ${detail}` : ""})。`;
  }
}

/** Googleアカウントでログインし、ドライブへのアクセストークンを取得する */
export async function connectDrive(clientId: string): Promise<void> {
  if (!clientId) throw new Error("GoogleのOAuthクライアントIDが設定されていません。");
  useDriveAuth.setState({ connecting: true, error: null });
  try {
    await loadGis();
    const oauth2 = window.google?.accounts?.oauth2;
    if (!oauth2) throw new Error("Googleのログイン機能を初期化できませんでした。");
    await new Promise<void>((resolve, reject) => {
      const client = oauth2.initTokenClient({
        client_id: clientId,
        scope: DRIVE_SCOPE,
        callback: (resp) => {
          if (resp.error || !resp.access_token) {
            reject(new Error(loginErrorMessage(resp.error, resp.error_description)));
            return;
          }
          // 期限の少し前に切れたものとして扱う
          setToken(resp.access_token, Date.now() + ((resp.expires_in ?? 3600) - 60) * 1000);
          resolve();
        },
        error_callback: (err) => reject(new Error(loginErrorMessage(err.type, err.message))),
      });
      client.requestAccessToken();
    });
    useDriveAuth.setState({ connecting: false, error: null });
  } catch (error) {
    useDriveAuth.setState({ connecting: false, error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

export function disconnectDrive() {
  const { token } = useDriveAuth.getState();
  if (token) window.google?.accounts?.oauth2?.revoke(token);
  setToken(null);
}

function authHeader(): Record<string, string> {
  const { token, expiresAt } = useDriveAuth.getState();
  if (!token || Date.now() >= expiresAt) {
    setToken(null);
    throw new Error("Googleドライブに接続していません(または接続の期限が切れました)。もう一度接続してください。");
  }
  return { Authorization: `Bearer ${token}` };
}

async function driveFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { ...init, headers: { ...authHeader(), ...(init.headers as Record<string, string>) } });
  if (res.status === 401) {
    setToken(null);
    throw new Error("Googleドライブの接続の期限が切れました。もう一度接続してください。");
  }
  if (!res.ok) {
    let message = `Googleドライブのエラー(${res.status})`;
    try {
      const body = await res.json();
      const reason: string | undefined = body?.error?.errors?.[0]?.reason ?? body?.error?.status;
      if (reason === "accessNotConfigured" || reason === "SERVICE_DISABLED") {
        message = "Google Cloud のプロジェクトで「Google Drive API」が有効になっていません。APIを有効にしてから数分待って、もう一度お試しください。";
      } else if (reason === "insufficientPermissions" || reason === "PERMISSION_DENIED" || res.status === 403) {
        message = `Googleドライブの権限がありません。ログイン時にドライブへのアクセスを許可したか、フォルダの共有設定を確認してください。(${body?.error?.message ?? res.status})`;
      } else if (res.status === 404) {
        message = "フォルダまたはファイルが見つかりません。URLが正しいか、このアカウントに共有されているか確認してください。";
      } else if (body?.error?.message) {
        message = `${message}: ${body.error.message}`;
      }
    } catch {
      /* JSONでないエラー本文は無視 */
    }
    throw new Error(message);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

const FILE_FIELDS = "id,name,mimeType,webViewLink,modifiedTime,size";
const ALL_DRIVES = "supportsAllDrives=true";

/** Drive の検索クエリ用に文字列をエスケープする */
function q(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/** フォルダのURLまたはIDからIDを取り出す */
export function parseFolderId(input: string): string {
  const trimmed = input.trim();
  const m = trimmed.match(/\/folders\/([A-Za-z0-9_-]+)/) ?? trimmed.match(/[?&]id=([A-Za-z0-9_-]+)/);
  return m ? m[1] : trimmed;
}

export function getItem(id: string) {
  return driveFetch<DriveItem & { parents?: string[] }>(`${API}/files/${encodeURIComponent(id)}?fields=${FILE_FIELDS},parents&${ALL_DRIVES}`);
}

export async function listChildren(folderId: string): Promise<DriveItem[]> {
  const params = new URLSearchParams({
    q: `'${q(folderId)}' in parents and trashed=false`,
    fields: `nextPageToken,files(${FILE_FIELDS})`,
    orderBy: "folder,name",
    pageSize: "200",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
    corpora: "allDrives",
  });
  const items: DriveItem[] = [];
  let pageToken: string | undefined;
  do {
    if (pageToken) params.set("pageToken", pageToken);
    const res = await driveFetch<{ files: DriveItem[]; nextPageToken?: string }>(`${API}/files?${params}`);
    items.push(...res.files);
    pageToken = res.nextPageToken;
  } while (pageToken);
  return items;
}

export function createFolder(name: string, parentId?: string) {
  return driveFetch<DriveItem>(`${API}/files?fields=${FILE_FIELDS}&${ALL_DRIVES}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, ...(parentId ? { parents: [parentId] } : {}) }),
  });
}

async function findFolder(name: string, parentId: string): Promise<DriveItem | undefined> {
  const params = new URLSearchParams({
    q: `'${q(parentId)}' in parents and name='${q(name)}' and mimeType='${FOLDER_MIME}' and trashed=false`,
    fields: `files(${FILE_FIELDS})`,
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
    corpora: "allDrives",
  });
  const res = await driveFetch<{ files: DriveItem[] }>(`${API}/files?${params}`);
  return res.files[0];
}

/** ルートから順にフォルダをたどり、なければ作成して最後のフォルダIDを返す */
export async function ensureFolderPath(rootId: string, names: string[]): Promise<string> {
  let parent = rootId;
  for (const name of names) {
    const found = await findFolder(name, parent);
    parent = found ? found.id : (await createFolder(name, parent)).id;
  }
  return parent;
}

async function multipartUpload(metadata: Record<string, unknown>, media: Blob, mediaType: string) {
  const boundary = `uchicare-${Math.random().toString(36).slice(2)}`;
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
    `--${boundary}\r\nContent-Type: ${mediaType}\r\n\r\n`,
    media,
    `\r\n--${boundary}--`,
  ]);
  return driveFetch<DriveItem>(`${UPLOAD_API}/files?uploadType=multipart&fields=${FILE_FIELDS}&${ALL_DRIVES}`, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
}

export function uploadFile(file: Blob, name: string, parentId: string) {
  const type = file.type || "application/octet-stream";
  return multipartUpload({ name, parents: [parentId] }, file, type);
}

/** HTMLをGoogleドキュメントに変換して保存する */
export function createGoogleDoc(name: string, html: string, parentId: string) {
  return multipartUpload(
    { name, parents: [parentId], mimeType: "application/vnd.google-apps.document" },
    new Blob([html], { type: "text/html" }),
    "text/html; charset=UTF-8"
  );
}

export function trashItem(id: string) {
  return driveFetch<DriveItem>(`${API}/files/${encodeURIComponent(id)}?${ALL_DRIVES}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trashed: true }),
  });
}

export function toRef(item: DriveItem): DriveFileRef {
  return { id: item.id, name: item.name, mimeType: item.mimeType, webViewLink: item.webViewLink };
}

export function fileIcon(mimeType: string): string {
  if (mimeType === FOLDER_MIME) return "📁";
  if (mimeType.includes("document") || mimeType.includes("word")) return "📄";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType.includes("csv")) return "📊";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "🖼️";
  if (mimeType.includes("pdf")) return "📕";
  if (mimeType.startsWith("audio/")) return "🎙️";
  if (mimeType.startsWith("image/")) return "🖼️";
  if (mimeType.startsWith("video/")) return "🎬";
  return "📎";
}

/** 議事録の保存先: 委員会議事録/<委員会名>/<年度> */
export function minutesFolderPath(committeeName: string, date: string): string[] {
  const [y, m] = date.split("-").map(Number);
  const fy = m >= 4 ? y : y - 1;
  return [MINUTES_FOLDER, committeeName, `${fy}年度`];
}
