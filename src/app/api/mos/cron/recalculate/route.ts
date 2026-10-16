// 毎朝8時（JST）の自動再計算。Vercel Cron（vercel.json）または外部スケジューラから呼ぶ。
// Authorization: Bearer <CRON_SECRET> が必要。
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getDb } from "@/mos/server/db";
import { purgeExpiredRawFiles } from "@/mos/server/importService";
import { recalculate } from "@/mos/server/recalc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function run(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = getDb();
  const purged = await purgeExpiredRawFiles(db);
  const r = await recalculate(db, { trigger: "CRON" });
  return NextResponse.json({ ok: true, months: r.months, runId: r.runId, purgedRawFiles: purged });
}

export const GET = run;
export const POST = run;
