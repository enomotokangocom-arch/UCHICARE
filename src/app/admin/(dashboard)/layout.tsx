import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/crm/session";
import { AdminNav } from "@/components/crm/AdminNav";
import { LogoutButton } from "@/components/crm/LogoutButton";

export default async function AdminDashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();
  if (!session) {
    redirect("/admin/login");
  }

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white sticky top-0">
        <Link href="/admin" className="flex items-center gap-2 border-b border-slate-200 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-600 text-lg font-bold text-white">
            U
          </div>
          <div>
            <p className="text-sm font-bold leading-tight text-slate-900">採用CRM</p>
            <p className="text-[11px] leading-tight text-slate-500">Uchi care Recruitment</p>
          </div>
        </Link>

        <AdminNav role={session.role} />

        <div className="border-t border-slate-200 px-4 py-3">
          <p className="truncate text-xs font-medium text-slate-700">{session.name}</p>
          <p className="text-[11px] text-slate-400">{session.role}</p>
          <LogoutButton />
        </div>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
