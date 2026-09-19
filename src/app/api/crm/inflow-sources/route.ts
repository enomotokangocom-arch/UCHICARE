import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/crm/prisma";
import { requireSession, apiErrorResponse } from "@/lib/crm/session";

export async function GET() {
  try {
    await requireSession();
    const inflowSources = await prisma.inflowSource.findMany({ orderBy: { createdAt: "asc" } });
    return NextResponse.json({ inflowSources });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

const createSchema = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(100),
  channel: z.string().min(1).max(100),
  campaign: z.string().max(100).optional(),
  qrUrl: z.string().url().max(500).optional(),
});

export async function POST(request: Request) {
  try {
    await requireSession({ requireAdmin: true });
    const json = await request.json().catch(() => null);
    const parsed = createSchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: "入力内容が不正です。" }, { status: 400 });
    const inflowSource = await prisma.inflowSource.create({ data: parsed.data });
    return NextResponse.json({ inflowSource });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
