import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/crm/prisma";
import { requireSession, apiErrorResponse } from "@/lib/crm/session";

export async function GET() {
  try {
    await requireSession();
    const areas = await prisma.area.findMany({ orderBy: { sortOrder: "asc" } });
    return NextResponse.json({ areas });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

const createSchema = z.object({ name: z.string().min(1).max(100), sortOrder: z.number().int().default(0) });

export async function POST(request: Request) {
  try {
    await requireSession({ requireAdmin: true });
    const json = await request.json().catch(() => null);
    const parsed = createSchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: "入力内容が不正です。" }, { status: 400 });
    const area = await prisma.area.create({ data: parsed.data });
    return NextResponse.json({ area });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
