import { createClient, SupabaseClient } from "@supabase/supabase-js";

/** Supabase の接続先(Project URL と Publishable key は公開してよい値) */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://yymyafbcemnxubaybylo.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_v2VYtgVGb12o_Q-_5kb84w_O2I0OXwA";

let client: SupabaseClient | null = null;

/** ブラウザ用のクライアント(ログイン状態はこの端末のブラウザに保存される) */
export function supabase(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: "uchicare-auth" },
    });
  }
  return client;
}
