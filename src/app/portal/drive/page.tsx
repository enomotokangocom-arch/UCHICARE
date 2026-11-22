"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { usePortalStore } from "@/lib/portal/store";
import {
  DriveItem,
  FOLDER_MIME,
  STANDARD_FOLDERS,
  createFolder,
  ensureFolderPath,
  fileIcon,
  getItem,
  listChildren,
  parseFolderId,
  trashItem,
  uploadFile,
} from "@/lib/portal/googleDrive";
import { DriveConnect } from "@/components/portal/DriveConnect";
import { useDrive } from "@/components/portal/useDrive";
import { Card, EmptyState, Field, PageContainer, PageHeader, buttonClass, inputClass } from "@/components/portal/ui";

type Crumb = { id: string; name: string };

function formatSize(size?: string) {
  if (!size) return "";
  const n = Number(size);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function SetupCard({ onChanged }: { onChanged: () => void }) {
  const drive = useDrive();
  const googleClientId = usePortalStore((s) => s.googleClientId);
  const setGoogleSettings = usePortalStore((s) => s.setGoogleSettings);
  const [rootInput, setRootInput] = useState(drive.rootId);
  const [rootName, setRootName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  // 初めて開いたときだけ、未設定なら開いた状態にする(設定中に勝手に閉じないよう以後は利用者の操作に任せる)
  const [open, setOpen] = useState(() => !drive.ready);

  useEffect(() => {
    if (!drive.connected || !drive.rootId) return;
    getItem(drive.rootId)
      .then((it) => setRootName(it.name))
      .catch(() => setRootName(null));
  }, [drive.connected, drive.rootId]);

  async function run(label: string, fn: () => Promise<string>) {
    setBusy(true);
    setBusyLabel(label);
    setMessage(null);
    try {
      setMessage(await fn());
      onChanged();
    } catch (e) {
      setMessage(`⚠ ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
      setBusyLabel(null);
    }
  }

  const rootButtonHint = !drive.connected
    ? "先に上の「Googleでログインして接続」を押してください。"
    : !rootInput.trim()
      ? "GoogleドライブでフォルダのURLをコピーして貼り付けてください。"
      : null;

  const statusLine =
    busyLabel || message ? (
      <p className={`rounded-lg px-3 py-2 text-sm ${busyLabel ? "bg-sky-50 text-sky-700" : message?.startsWith("⚠") ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
        {busyLabel ? `⏳ ${busyLabel}` : message}
      </p>
    ) : null;

  return (
    <Card className="mb-5">
      <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)} id="setup" className="scroll-mt-20">
        <summary className="cursor-pointer text-sm font-bold text-slate-900">⚙️ Googleドライブ連携の設定</summary>
        <div className="mt-4 space-y-4">
          <Field
            label="OAuth クライアントID"
            hint={
              process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
                ? "環境変数で設定済みです(ここに入力するとこちらが優先されます)"
                : "Google Cloud で作成した「ウェブ アプリケーション」のクライアントID(xxxx.apps.googleusercontent.com)"
            }
          >
            <input
              className={inputClass}
              placeholder="xxxxxxxx.apps.googleusercontent.com"
              value={googleClientId}
              onChange={(e) => setGoogleSettings({ googleClientId: e.target.value.trim() })}
            />
          </Field>

          <DriveConnect />

          <Field
            label="保存先のルートフォルダ(URL または ID)"
            hint="共有ドライブや共有フォルダのURLを貼り付けると、職員全員で同じフォルダを使えます"
          >
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                className={inputClass}
                placeholder="https://drive.google.com/drive/folders/..."
                value={rootInput}
                onChange={(e) => setRootInput(e.target.value)}
              />
              <button
                type="button"
                className={buttonClass.secondary}
                disabled={!drive.connected || busy || !rootInput.trim()}
                onClick={() =>
                  run("フォルダを確認しています...", async () => {
                    const id = parseFolderId(rootInput);
                    const item = await getItem(id);
                    if (item.mimeType !== FOLDER_MIME) throw new Error("フォルダではありません。");
                    setGoogleSettings({ driveRootFolderId: id });
                    setRootInput(id);
                    setRootName(item.name);
                    return `「${item.name}」を保存先に設定しました。`;
                  })
                }
              >
                {busyLabel === "フォルダを確認しています..." ? "確認中..." : "このフォルダを使う"}
              </button>
            </div>
          </Field>
          {rootButtonHint && <p className="-mt-2 text-xs text-amber-700">{rootButtonHint}</p>}
          {statusLine}
          {drive.rootId && rootName && <p className="text-xs text-slate-600">現在の保存先: 📁 {rootName}</p>}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={buttonClass.secondary}
              disabled={!drive.connected || busy}
              onClick={() =>
                run("フォルダを作成しています...", async () => {
                  const folder = await createFolder("Uchi care ポータル");
                  setGoogleSettings({ driveRootFolderId: folder.id });
                  setRootInput(folder.id);
                  setRootName(folder.name);
                  return "マイドライブに「Uchi care ポータル」フォルダを作成し、保存先に設定しました。";
                })
              }
            >
              マイドライブに新しく作る
            </button>
            <button
              type="button"
              className={buttonClass.secondary}
              disabled={!drive.ready || busy}
              onClick={() =>
                run("標準フォルダを作成しています...", async () => {
                  for (const name of STANDARD_FOLDERS) await ensureFolderPath(drive.rootId, [name]);
                  return `標準フォルダ(${STANDARD_FOLDERS.join("・")})を作成しました。`;
                })
              }
            >
              標準フォルダを作成
            </button>
          </div>

          <details className="rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
            <summary className="cursor-pointer font-semibold">初めて設定する方へ(Google Cloud での準備)</summary>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Google Cloud コンソールでプロジェクトを作成し、「Google Drive API」を有効にします。</li>
              <li>「OAuth 同意画面」を作成します。会社の Google Workspace を使っている場合は、ユーザーの種類を「内部」にすると社内アカウントだけが使えます。</li>
              <li>「認証情報」→「OAuth クライアント ID」→ 種類「ウェブ アプリケーション」で作成し、「承認済みの JavaScript 生成元」にこのアプリのURL(例: https://〇〇.vercel.app)を追加します。</li>
              <li>作成されたクライアントIDを上の欄に貼り付けるか、Vercel の環境変数 NEXT_PUBLIC_GOOGLE_CLIENT_ID に設定します。</li>
            </ol>
          </details>
        </div>
      </details>
    </Card>
  );
}

export default function DrivePage() {
  const drive = useDrive();
  const [path, setPath] = useState<Crumb[]>([]);
  const [listing, setListing] = useState<{ folderId: string; items: DriveItem[] } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [newFolder, setNewFolder] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);

  const currentId = path.length ? path[path.length - 1].id : drive.rootId;
  const loading = !listing || listing.folderId !== currentId;
  const items = listing?.items ?? [];
  const reload = () => {
    setError(null);
    setRefreshKey((k) => k + 1);
  };

  useEffect(() => {
    if (!drive.ready || !currentId) return;
    let cancelled = false;
    listChildren(currentId)
      .then((list) => !cancelled && setListing({ folderId: currentId, items: list }))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [drive.ready, currentId, refreshKey]);

  useEffect(() => {
    if (!drive.ready) return;
    getItem(drive.rootId)
      .then((root) => setPath([{ id: root.id, name: root.name }]))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [drive.ready, drive.rootId]);

  async function onUpload(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length || !currentId) return;
    try {
      for (const [i, f] of files.entries()) {
        setUploading(`${f.name}(${i + 1}/${files.length})`);
        await uploadFile(f, f.name, currentId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(null);
      reload();
    }
  }

  return (
    <PageContainer>
      <PageHeader
        icon="🗄️"
        title="書類フォルダ"
        description="Googleドライブのフォルダをアプリから管理します。ここで作成・アップロードしたものは、そのままGoogleドライブに保存されます。"
      />

      <SetupCard onChanged={reload} />

      {!drive.ready ? (
        <EmptyState>Googleドライブに接続し、保存先のルートフォルダを設定するとフォルダを表示します。</EmptyState>
      ) : (
        <Card className="p-0 sm:p-0">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
            <nav className="flex flex-wrap items-center gap-1 text-sm">
              {path.map((c, i) => (
                <span key={c.id} className="flex items-center gap-1">
                  {i > 0 && <span className="text-slate-300">/</span>}
                  <button
                    type="button"
                    className={i === path.length - 1 ? "font-bold text-slate-900" : "font-semibold text-brand-700 hover:underline"}
                    onClick={() => setPath(path.slice(0, i + 1))}
                  >
                    {i === 0 ? `📁 ${c.name}` : c.name}
                  </button>
                </span>
              ))}
            </nav>
            <div className="flex flex-wrap gap-2">
              <form
                className="flex gap-1"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!newFolder.trim() || !currentId) return;
                  try {
                    await createFolder(newFolder.trim(), currentId);
                    setNewFolder("");
                    reload();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : String(err));
                  }
                }}
              >
                <input className={`${inputClass} w-40 py-1.5`} placeholder="新しいフォルダ名" value={newFolder} onChange={(e) => setNewFolder(e.target.value)} />
                <button type="submit" className={`${buttonClass.secondary} whitespace-nowrap`} disabled={!newFolder.trim()}>
                  ＋ フォルダ
                </button>
              </form>
              <label className={`${buttonClass.primary} cursor-pointer`}>
                ⬆ アップロード
                <input type="file" multiple className="hidden" onChange={onUpload} />
              </label>
              <button type="button" className={buttonClass.ghost} onClick={reload}>
                ↻ 更新
              </button>
            </div>
          </div>
          {uploading && <p className="bg-sky-50 px-4 py-2 text-xs text-sky-700">アップロード中: {uploading}</p>}
          {error && <p className="bg-rose-50 px-4 py-2 text-xs text-rose-700">⚠ {error}</p>}
          {loading ? (
            <p className="p-6 text-center text-sm text-slate-400">読み込み中...</p>
          ) : items.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-400">このフォルダは空です。</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {items.map((it) => {
                const isFolder = it.mimeType === FOLDER_MIME;
                return (
                  <li key={it.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                    <span className="text-xl">{fileIcon(it.mimeType)}</span>
                    {isFolder ? (
                      <button
                        type="button"
                        className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-slate-800 hover:text-brand-700"
                        onClick={() => setPath([...path, { id: it.id, name: it.name }])}
                      >
                        {it.name}
                      </button>
                    ) : (
                      <a
                        href={it.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-w-0 flex-1 truncate text-sm text-slate-800 hover:text-brand-700 hover:underline"
                      >
                        {it.name}
                      </a>
                    )}
                    <span className="hidden text-xs text-slate-400 sm:block">{formatSize(it.size)}</span>
                    <span className="hidden w-36 text-right text-xs text-slate-400 md:block">
                      {it.modifiedTime ? new Date(it.modifiedTime).toLocaleString("ja-JP", { dateStyle: "short", timeStyle: "short" }) : ""}
                    </span>
                    <a href={it.webViewLink} target="_blank" rel="noopener noreferrer" className={buttonClass.ghost} title="Googleドライブで開く">
                      ↗
                    </a>
                    <button
                      type="button"
                      className={buttonClass.danger}
                      onClick={async () => {
                        if (!confirm(`「${it.name}」をゴミ箱に移動しますか?(Googleドライブのゴミ箱から30日以内なら復元できます)`)) return;
                        try {
                          await trashItem(it.id);
                          reload();
                        } catch (err) {
                          setError(err instanceof Error ? err.message : String(err));
                        }
                      }}
                    >
                      削除
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}
    </PageContainer>
  );
}
