"use client";

import Link from "next/link";
import { useDrive } from "./useDrive";
import { buttonClass } from "./ui";

/** Googleドライブの接続状態を表示し、接続ボタンを出す小さなバー */
export function DriveConnect({ compact }: { compact?: boolean }) {
  const drive = useDrive();

  if (!drive.clientId) {
    return (
      <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
        Googleドライブ連携が未設定です。
        <Link href="/portal/drive#setup" className="ml-1 font-semibold text-teal-700 hover:underline">
          連携の設定をする →
        </Link>
      </p>
    );
  }
  if (!drive.connected) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <span>Googleドライブに未接続です。</span>
        <button
          type="button"
          className={buttonClass.secondary}
          disabled={drive.connecting}
          onClick={() => drive.connect().catch(() => undefined)}
        >
          {drive.connecting ? "接続中..." : "Googleでログインして接続"}
        </button>
        {drive.error && <span className="text-rose-600">{drive.error}</span>}
      </div>
    );
  }
  if (!drive.rootId) {
    return (
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
        ● Googleドライブに接続中です。保存先のルートフォルダが未設定です。
        <Link href="/portal/drive#setup" className="ml-1 font-semibold text-teal-700 hover:underline">
          設定する →
        </Link>
      </p>
    );
  }
  return compact ? (
    <span className="text-[11px] font-semibold text-emerald-700">● Googleドライブ接続中</span>
  ) : (
    <p className="flex flex-wrap items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
      ● Googleドライブに接続中
      <button type="button" className={buttonClass.ghost} onClick={drive.disconnect}>
        切断
      </button>
    </p>
  );
}
