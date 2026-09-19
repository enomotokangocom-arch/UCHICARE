import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/crm/prisma";
import { requireSession, apiErrorResponse } from "@/lib/crm/session";

export async function GET() {
  try {
    await requireSession();
    const occupations = await prisma.occupation.findMany({ orderBy: { sortOrder: "asc" } });
    return NextResponse.json({ occupations });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

const createSchema = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(100),
  sortOrder: z.number().int().default(0),
});

export async function POST(request: Request) {
  try {
    await requireSession({ requireAdmin: true });
    const json = await request.json().catch(() => null);
    const parsed = createSchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: "入力内容が不正です。" }, { status: 400 });
    const occupation = await prisma.occupation.create({ data: parsed.data });
    return NextResponse.json({ occupation });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
