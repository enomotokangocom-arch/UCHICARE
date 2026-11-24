"use client";

import { ReactNode, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { loadMember, Member, signOut, useAuth } from "@/lib/portal/auth";
import { usePortalStore } from "@/lib/portal/store";
import { applyLocal, refreshFromServer, startSync, useSync } from "@/lib/portal/sync";
import { AuthShell, LoginScreen, NewPasswordScreen } from "./LoginScreen";
import { SyncStatus } from "./ServerDataSection";

/** 操作がないまま この時間が過ぎたら自動でログアウトする */
const IDLE_LIMIT_MS = 60 * 60 * 1000;

/** ログインした職員の情報(役職・事業所)を、この端末のデータに反映する */
function syncMemberToStore(m: Member) {
  // サーバーと同期しているとき、職員マスタを書き換えられるのは経営者・統括部長だけ。
  // それ以外の人は画面の表示だけを合わせる(権限はサーバーがログイン情報から判定する)
  if (useSync.getState().mode === "server" && !m.is_admin) applyLocal(() => applyMember(m));
  else applyMember(m);
}

function applyMember(m: Member) {
  const state = usePortalStore.getState();
  const staff = state.staff.find((s) => s.id === m.staff_id);
  if (!staff) {
    state.collection("staff").add({
      id: m.staff_id,
      name: m.name || m.email,
      unitId: m.unit_id,
      role: "看護師",
      position: m.position,
      isDriver: true,
      isSafetyManager: false,
      isEvaluator: m.is_admin,
      active: true,
    });
  } else if (staff.position !== m.position || staff.unitId !== m.unit_id) {
    state.collection("staff").update(staff.id, { position: m.position, unitId: m.unit_id });
  }
  state.setCurrentStaffId(m.staff_id);
}

async function refresh() {
  const { data } = await supabase().auth.getSession();
  const session = data.session;
  if (!session) {
    useAuth.setState({ status: "signedOut", session: null, member: null, error: null });
    return;
  }
  const { member, setupNeeded, error } = await loadMember(session.user.id);
  if (setupNeeded) return useAuth.setState({ status: "setupNeeded", session, member: null, error: null });
  if (error) return useAuth.setState({ status: "error", session, member: null, error });
  if (!member || !member.active) return useAuth.setState({ status: "noMember", session, member: null, error: null });
  if (useAuth.getState().member?.user_id !== member.user_id || useSync.getState().mode === "off") await startSync();
  syncMemberToStore(member);
  useAuth.setState({ status: "signedIn", session, member, error: null });
}

function Message({ title, body }: { title: string; body: ReactNode }) {
  return (
    <AuthShell>
      <h2 className="text-sm font-bold text-slate-900">{title}</h2>
      <div className="mt-2 text-sm leading-relaxed text-slate-600">{body}</div>
      <button type="button" className="mt-5 w-full rounded-lg border border-slate-300 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => signOut()}>
        ログアウト
      </button>
    </AuthShell>
  );
}

/** ログインしていなければログイン画面を出す */
export function AuthGate({ children }: { children: ReactNode }) {
  const status = useAuth((s) => s.status);
  const member = useAuth((s) => s.member);
  const error = useAuth((s) => s.error);
  const currentStaffId = usePortalStore((s) => s.currentStaffId);
  const setCurrentStaffId = usePortalStore((s) => s.setCurrentStaffId);

  useEffect(() => {
    refresh();
    const { data } = supabase().auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") useAuth.setState({ status: "recovery" });
      else if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") void refresh();
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // 管理者以外は、ログインした本人以外として使えないようにする
  useEffect(() => {
    if (status === "signedIn" && member && !member.is_admin && currentStaffId !== member.staff_id) setCurrentStaffId(member.staff_id);
  }, [status, member, currentStaffId, setCurrentStaffId]);

  // 一定時間 操作がなければログアウトする。画面に戻ってきたら他の職員の変更を読み込む
  useEffect(() => {
    if (status !== "signedIn") return;
    let last = Date.now();
    const touch = () => {
      last = Date.now();
    };
    const check = () => {
      if (Date.now() - last > IDLE_LIMIT_MS) void signOut("しばらく操作がなかったため、安全のためログアウトしました。もう一度ログインしてください。");
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      check();
      void refreshFromServer();
    };
    const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    for (const e of events) window.addEventListener(e, touch, { passive: true });
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(check, 60_000);
    return () => {
      for (const e of events) window.removeEventListener(e, touch);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [status]);

  if (status === "loading") {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">読み込み中...</div>;
  }
  if (status === "signedOut") return <LoginScreen />;
  if (status === "recovery") return <NewPasswordScreen />;
  if (status === "setupNeeded") {
    return <Message title="データベースの初期設定がまだです" body={<>管理者が Supabase で初期設定(SQLの実行)を行うと使えるようになります。</>} />;
  }
  if (status === "noMember") {
    return <Message title="このアカウントは使えません" body={<>職員として登録されていないか、無効になっています。管理者に確認してください。</>} />;
  }
  if (status === "error") return <Message title="読み込みに失敗しました" body={error} />;
  return (
    <>
      {children}
      <SyncStatus />
    </>
  );
}
