// ファイルアップロード（複数可）。管理者・事務のみ。
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/mos/server/auth";
import { getDb, requireEnv } from "@/mos/server/db";
import { importFile } from "@/mos/server/importService";
import { parseYearMonth } from "@/mos/domain/normalize";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 20 * 1024 * 1024;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
  if (user.role === "STAFF") return NextResponse.json({ error: "取込の権限がありません" }, { status: 403 });

  const form = await request.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return NextResponse.json({ error: "ファイルを選択してください" }, { status: 400 });

  const zestRaw = String(form.get("zestYearMonth") ?? "").trim();
  let zestYearMonth: string | null = null;
  if (zestRaw) {
    const ym = parseYearMonth(zestRaw);
    if (!ym.ok) return NextResponse.json({ error: `ZEST の対象年月: ${ym.reason}` }, { status: 400 });
    zestYearMonth = ym.value;
  }
  const ctx = { db: getDb(), userId: user.id, origin: "REAL" as const, hashSecret: requireEnv("MOS_HASH_SECRET"), zestYearMonth };
  const results = [];
  for (const file of files) {
    if (file.size > MAX_BYTES) {
      results.push({ fileName: file.name, status: "FAILED", error: "ファイルサイズが上限（20MB）を超えています" });
      continue;
    }
    const r = await importFile(ctx, file.name, new Uint8Array(await file.arrayBuffer()));
    results.push({ fileName: file.name, ...r });
  }
  return NextResponse.json({ results });
}
