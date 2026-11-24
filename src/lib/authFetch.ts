"use client";

import { supabase } from "@/lib/supabase";

/** サーバーのAPIを呼ぶときに付けるログイン情報(APIはこれを確認してから処理する) */
export async function authHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  const { data } = await supabase().auth.getSession();
  const token = data.session?.access_token;
  return { ...extra, ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}
