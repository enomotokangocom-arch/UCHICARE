"use client";

import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { BusinessUnitId, Position } from "./types";

/** ログインできる職員(Supabase の portal_members) */
export interface Member {
  id: string;
  email: string;
  staff_id: string;
  name: string;
  unit_id: BusinessUnitId;
  position: Position;
  is_admin: boolean;
  active: boolean;
  invite_code: string | null;
  user_id: string | null;
  registered_at: string | null;
  created_at: string;
}

export type AuthStatus = "loading" | "signedOut" | "recovery" | "signedIn" | "noMember" | "setupNeeded" | "error";

interface AuthState {
  status: AuthStatus;
  session: Session | null;
  member: Member | null;
  error: string | null;
}

export const useAuth = create<AuthState>(() => ({ status: "loading", session: null, member: null, error: null }));

export const ADMIN_POSITIONS: Position[] = ["経営者", "統括部長", "事務長"];

/** 紛らわしい文字(0/O、1/I/L)を除いた6文字の招待コード */
export function generateInviteCode(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const arr = new Uint32Array(6);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => chars[n % chars.length]).join("");
}

/** Supabase のエラーを日本語にする */
export function authErrorMessage(message: string): string {
  if (/Invalid login credentials/i.test(message)) return "メールアドレスまたはパスワードが違います。";
  if (/Email not confirmed/i.test(message)) return "メールアドレスの確認が終わっていません。管理者に連絡してください。";
  if (/Password should be at least/i.test(message)) return "パスワードは8文字以上にしてください。";
  if (/User already registered/i.test(message)) return "このメールアドレスはすでに登録されています。ログインしてください。";
  if (/Database error saving new user/i.test(message)) return "登録できませんでした。メールアドレスと招待コードを確認してください。";
  if (/rate limit/i.test(message)) return "短時間に何度も操作されたため、しばらく待ってからお試しください。";
  if (/Failed to fetch|NetworkError/i.test(message)) return "サーバーに接続できませんでした。通信環境を確認してください。";
  return message;
}

export async function loadMember(userId: string): Promise<{ member: Member | null; setupNeeded: boolean; error: string | null }> {
  const { data, error } = await supabase().from("portal_members").select("*").eq("user_id", userId).maybeSingle();
  if (error) {
    // 表がまだない(SQLを実行していない)
    if (error.code === "42P01" || error.code === "PGRST205" || /portal_members/.test(error.message)) {
      return { member: null, setupNeeded: true, error: null };
    }
    return { member: null, setupNeeded: false, error: error.message };
  }
  return { member: (data as Member | null) ?? null, setupNeeded: false, error: null };
}

export async function signOut() {
  await supabase().auth.signOut();
  useAuth.setState({ status: "signedOut", session: null, member: null, error: null });
}
