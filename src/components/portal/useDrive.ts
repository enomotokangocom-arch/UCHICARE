"use client";

import { usePortalStore } from "@/lib/portal/store";
import { connectDrive, disconnectDrive, useDriveAuth } from "@/lib/portal/googleDrive";

/** Googleドライブの接続状態と操作をまとめたフック */
export function useDrive() {
  const storedClientId = usePortalStore((s) => s.googleClientId);
  const rootId = usePortalStore((s) => s.driveRootFolderId);
  const token = useDriveAuth((s) => s.token);
  const connecting = useDriveAuth((s) => s.connecting);
  const error = useDriveAuth((s) => s.error);

  // 設定画面で入力したクライアントIDを優先し、なければ環境変数を使う
  const clientId = storedClientId || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
  // 期限切れのトークンは googleDrive.ts 側でタイマーにより破棄される
  const connected = !!token;

  return {
    clientId,
    rootId,
    connected,
    ready: connected && !!rootId,
    connecting,
    error,
    connect: () => connectDrive(clientId),
    disconnect: disconnectDrive,
  };
}
