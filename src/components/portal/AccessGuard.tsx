"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { useCurrentStaff } from "@/lib/portal/store";
import { canViewHealthTool, isHealthToolPath } from "@/lib/portal/logic";

/**
 * 画面ごとの閲覧権限。健康経営ツールは責任者以上(経営者・統括部長・事務長・所長・リハ責任者)のみ。
 * ※ログインの仕組みが入るまでは画面上の制限であり、本番運用ではサーバー側での制限が必要。
 */
export function AccessGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const current = useCurrentStaff();

  if (isHealthToolPath(pathname) && !canViewHealthTool(current)) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-4xl">🔒</p>
        <h1 className="mt-3 text-lg font-bold text-brand-700">閲覧権限がありません</h1>
        <p className="mt-2 text-sm text-slate-500">
          健康経営ツールは、責任者以上(経営者・統括部長・事務長・所長・リハ責任者)のみ閲覧できます。
        </p>
        <Link href="/portal" className="mt-6 inline-block text-sm font-semibold text-brand-700 hover:underline">
          ポータルホームへ戻る →
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}
