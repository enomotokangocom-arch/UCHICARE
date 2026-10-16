import { requireUser } from "@/mos/server/auth";
import { logoutAction } from "@/mos/server/actions";
import { ROLE_LABEL } from "@/mos/domain/types";
import { Nav } from "@/mos/ui/Nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-slate-200 bg-white md:sticky md:top-0 md:h-screen md:w-56 md:shrink-0 md:border-r md:border-b-0">
        <div className="flex items-center justify-between gap-2 px-4 py-3 md:block md:py-5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600 text-sm font-bold text-white">U</div>
            <div className="leading-tight">
              <p className="text-sm font-bold">Uchi Management OS</p>
              <p className="text-[11px] text-slate-500">経営管理</p>
            </div>
          </div>
          <div className="text-right text-xs text-slate-600 md:mt-4 md:text-left">
            <p>
              {user.name}（{ROLE_LABEL[user.role]}）
            </p>
            <form action={logoutAction}>
              <button className="text-teal-700 underline">ログアウト</button>
            </form>
          </div>
        </div>
        <div className="px-2 pb-2 md:px-3">
          <Nav role={user.role} />
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
