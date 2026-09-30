import { createRoot } from "react-dom/client";
import { Suspense, useMemo, useState, useSyncExternalStore } from "react";
import initSqlJs from "sql.js/dist/sql-asm.js";
import { DB } from "./shims/db";
import { installBackend } from "./backend";
import { getLocation, getPath, navigate, subscribe } from "./shims/router";
import { SCHEMA_SQL } from "../src/onboarding/server/schema";
import { seedDemo } from "../src/onboarding/server/demo";

import OnboardingLayout from "../src/app/onboarding/layout";
import Dashboard from "../src/app/onboarding/page";
import LoginPage from "../src/app/onboarding/login/page";
import NewHirePage from "../src/app/onboarding/hires/new/page";
import HirePage from "../src/app/onboarding/hires/[id]/page";
import PrintHire from "../src/app/onboarding/hires/[id]/print/page";
import TaskPage from "../src/app/onboarding/tasks/[id]/page";
import ApplePage from "../src/app/onboarding/apple/page";
import DevicesPage from "../src/app/onboarding/devices/page";
import ManualPage from "../src/app/onboarding/manual/page";
import SettingsPage from "../src/app/onboarding/settings/page";
import GuidePage from "../src/app/onboarding/guide/page";

const STORE_KEY = "uchicare-onboarding-demo-db-v1";

function toB64(u8: Uint8Array) {
  let s = "";
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromB64(b64: string) {
  const s = atob(b64);
  const u8 = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
  return u8;
}

type Params = { id: string };
function Route() {
  const path = useSyncExternalStore(subscribe, getPath, getPath);
  const m = (re: RegExp) => path.match(re);
  const id = (m(/^\/onboarding\/(?:hires|tasks)\/(\d+)/) ?? [])[1] ?? "";
  // use(params) 用に、同じidなら同じPromiseを渡す
  const params = useMemo(() => Promise.resolve<Params>({ id }), [id]);
  let page: React.ReactNode;
  if (path === "/onboarding/login") page = <LoginPage />;
  else if (path === "/onboarding/hires/new") page = <NewHirePage />;
  else if (m(/^\/onboarding\/hires\/\d+\/print$/)) page = <PrintHire params={params} />;
  else if (m(/^\/onboarding\/hires\/\d+$/)) page = <HirePage params={params} />;
  else if (m(/^\/onboarding\/tasks\/\d+$/)) page = <TaskPage params={params} />;
  else if (path === "/onboarding/apple") page = <ApplePage />;
  else if (path === "/onboarding/devices") page = <DevicesPage />;
  else if (path === "/onboarding/manual") page = <ManualPage />;
  else if (path === "/onboarding/settings") page = <SettingsPage />;
  else if (path === "/onboarding/guide") page = <GuidePage />;
  else page = <Dashboard />;
  return (
    <OnboardingLayout>
      <Suspense fallback={<p className="text-sm text-slate-400">読み込み中...</p>}>
        <div key={getLocation()}>{page}</div>
      </Suspense>
    </OnboardingLayout>
  );
}

function ResetButton({ onReset }: { onReset: () => void }) {
  const [armed, setArmed] = useState(false);
  return (
    <div className="fixed bottom-3 right-3 z-50 flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-[11px] text-slate-600 shadow ring-1 ring-slate-200 print:hidden">
      <span className="whitespace-nowrap">データはこのブラウザだけに保存</span>
      <button
        type="button"
        className={armed ? "whitespace-nowrap rounded-full bg-rose-600 px-2 py-0.5 font-semibold text-white" : "whitespace-nowrap rounded-full border border-slate-300 px-2 py-0.5 font-semibold hover:bg-slate-50"}
        onClick={() => (armed ? onReset() : setArmed(true))}
        onBlur={() => setArmed(false)}
      >
        {armed ? "もう一度押すと初期化" : "最初からやり直す"}
      </button>
    </div>
  );
}

async function main() {
  const SQL = await initSqlJs();
  let saved: string | null = null;
  try { saved = localStorage.getItem(STORE_KEY); } catch { /* 保存できない環境 */ }
  let raw;
  try { raw = saved ? new SQL.Database(fromB64(saved)) : null; } catch { raw = null; }
  const fresh = !raw;
  const db = new DB(raw ?? new SQL.Database());
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA_SQL);
  if (fresh) seedDemo(db as never);

  const persist = () => {
    try { localStorage.setItem(STORE_KEY, toB64(db.raw.export())); } catch { /* 容量不足・保存不可 */ }
    db.exec("PRAGMA foreign_keys = ON;");
  };
  persist();
  installBackend(db, persist);

  const w = window as unknown as Record<string, unknown>;
  w.__obDemo = true;
  w.__obNavigate = navigate;
  w.__obLocation = getLocation;

  const reset = () => {
    try { localStorage.removeItem(STORE_KEY); sessionStorage.clear(); } catch { /* 無視 */ }
    location.reload();
  };
  navigate("/onboarding");
  createRoot(document.getElementById("root")!).render(
    <>
      <Route />
      <ResetButton onReset={reset} />
    </>,
  );
}

main().catch((e) => {
  document.getElementById("root")!.textContent = "デモを起動できませんでした: " + (e as Error).message;
});
