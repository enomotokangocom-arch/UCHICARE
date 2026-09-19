import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/crm/prisma";
import { requireSession, apiErrorResponse } from "@/lib/crm/session";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const updateSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  points: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    await requireSession({ requireAdmin: true });
    const { id } = await params;
    const json = await request.json().catch(() => null);
    const parsed = updateSchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: "入力内容が不正です。" }, { status: 400 });
    const rule = await prisma.leadScoreRule.update({ where: { id }, data: parsed.data });
    return NextResponse.json({ rule });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
