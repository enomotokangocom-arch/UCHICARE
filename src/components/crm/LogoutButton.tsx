"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/crm/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="mt-2 w-full rounded-md border border-slate-200 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
    >
      ログアウト
    </button>
  );
}
