import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/crm/prisma";
import { requireSession, apiErrorResponse } from "@/lib/crm/session";

export async function GET() {
  try {
    await requireSession();
    const tags = await prisma.tag.findMany({ orderBy: [{ category: "asc" }, { sortOrder: "asc" }] });
    return NextResponse.json({ tags });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

const createSchema = z.object({
  code: z.string().min(1).max(64),
  label: z.string().min(1).max(100),
  category: z.enum(["OCCUPATION", "TIMING", "LEAD_STATUS", "ACTION", "RECRUITMENT", "CUSTOM"]),
  color: z.string().max(20).optional(),
});

export async function POST(request: Request) {
  try {
    await requireSession({ requireAdmin: true });
    const json = await request.json().catch(() => null);
    const parsed = createSchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: "入力内容が不正です。" }, { status: 400 });

    const tag = await prisma.tag.create({ data: parsed.data });
    return NextResponse.json({ tag });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
