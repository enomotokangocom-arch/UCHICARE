"use client";

import { useEffect, useState } from "react";
import { useHealthDataStore } from "@/lib/store";

/**
 * zustand persist は skipHydration:true のため、マウント後に手動で
 * localStorage からの復元を行う(SSRとCSRの初期HTML不一致を避けるため)。
 */
export function StoreHydration({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    Promise.resolve(useHealthDataStore.persist.rehydrate()).then(() => {
      setHydrated(true);
    });
  }, []);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">
        読み込み中...
      </div>
    );
  }

  return <>{children}</>;
}
