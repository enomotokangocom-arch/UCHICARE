"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { StoreHydration } from "@/components/StoreHydration";

/**
 * UCHICARE (健康経営ダッシュボード) と Uchi OS は別プロダクトのため、
 * ルートレイアウトの共通chrome (Sidebar・localStorageハイドレーション) は
 * UCHICARE側のパスにのみ適用する。Uchi OS は自身のlayout.tsx で画面を制御する。
 */
export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname?.startsWith("/uchi-os")) {
    return <>{children}</>;
  }

  return (
    <StoreHydration>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </StoreHydration>
  );
}
