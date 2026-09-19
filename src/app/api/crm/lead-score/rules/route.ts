import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/crm/prisma";
import { requireSession, apiErrorResponse } from "@/lib/crm/session";

export async function GET() {
  try {
    await requireSession();
    const rules = await prisma.leadScoreRule.findMany({ orderBy: { points: "desc" } });
    return NextResponse.json({ rules });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

const createSchema = z.object({
  actionCode: z.string().min(1).max(64),
  label: z.string().min(1).max(100),
  points: z.number().int(),
});

export async function POST(request: Request) {
  try {
    await requireSession({ requireAdmin: true });
    const json = await request.json().catch(() => null);
    const parsed = createSchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: "入力内容が不正です。" }, { status: 400 });
    const rule = await prisma.leadScoreRule.create({ data: parsed.data });
    return NextResponse.json({ rule });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
