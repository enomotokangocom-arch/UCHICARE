import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase";

/** 役職の序列(数字が小さいほど上位)。supabase/security.sql の portal_position_rank と同じ */
const RANK: Record<string, number> = { 経営者: 0, 統括部長: 1, 管理者: 2, 所長: 2, 事務長: 2, 責任者: 3, リハ責任者: 3, 主任: 4 };
export const positionRank = (p: string) => RANK[p] ?? 5;

export interface ApiMember {
  staffId: string;
  unitId: string;
  position: string;
  rank: number;
}

type Result = { member: ApiMember; error?: undefined } | { member?: undefined; error: NextResponse };

const fail = (status: number, error: string) => ({ error: NextResponse.json({ error }, { status }) });

/**
 * APIの入口で必ず呼ぶ。ログイン中の有効な職員かを Supabase に問い合わせて確かめる。
 * (ブラウザから送られた役職などは信用せず、サーバー側で引き直す)
 *  - maxRank: この序列以内の役職だけ許可(例: 3 = 責任者以上)
 *  - maxBytes: 受け付ける本文の大きさの上限
 */
export async function requireMember(request: NextRequest, opts: { maxRank?: number; maxBytes?: number } = {}): Promise<Result> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > (opts.maxBytes ?? 300_000)) return fail(413, "送信する内容が大きすぎます。");

  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return fail(401, "ログインが必要です。ページを読み込み直してください。");

  const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userError } = await client.auth.getUser(token);
  if (userError || !userData.user) return fail(401, "ログインの有効期限が切れています。もう一度ログインしてください。");

  const { data: m, error } = await client
    .from("portal_members")
    .select("staff_id, unit_id, position, active")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (error) return fail(503, "ログイン情報を確認できませんでした。しばらくしてからお試しください。");
  if (!m || !m.active) return fail(403, "このアカウントは使えません。");

  const member: ApiMember = { staffId: m.staff_id, unitId: m.unit_id, position: m.position, rank: positionRank(m.position) };
  if (opts.maxRank !== undefined && member.rank > opts.maxRank) return fail(403, "この機能を使う権限がありません。");
  return { member };
}
