import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/mos/server/auth";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "ログイン" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/mos");
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-600 font-bold text-white">U</div>
          <div>
            <p className="text-sm font-bold">Uchi Management OS</p>
            <p className="text-xs text-slate-500">株式会社Uchi care</p>
          </div>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
