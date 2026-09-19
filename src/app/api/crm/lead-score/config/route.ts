import { NextResponse } from "next/server";
import { z } from "zod";
import { getLeadScoreConfig } from "@/lib/crm/events";
import { prisma } from "@/lib/crm/prisma";
import { requireSession, apiErrorResponse } from "@/lib/crm/session";

export async function GET() {
  try {
    await requireSession();
    const config = await getLeadScoreConfig();
    return NextResponse.json({ config });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

const updateSchema = z.object({
  warmThreshold: z.number().int().min(0),
  hotThreshold: z.number().int().min(0),
  decayEnabled: z.boolean().optional(),
  decayPoints: z.number().int().min(0).optional(),
  decayAfterDays: z.number().int().min(1).optional(),
});

export async function PATCH(request: Request) {
  try {
    await requireSession({ requireAdmin: true });
    const json = await request.json().catch(() => null);
    const parsed = updateSchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: "入力内容が不正です。" }, { status: 400 });
    if (parsed.data.hotThreshold <= parsed.data.warmThreshold) {
      return NextResponse.json({ error: "HOT閾値はWARM閾値より大きい値にしてください。" }, { status: 400 });
    }

    const existing = await getLeadScoreConfig();
    const config = await prisma.leadScoreConfig.update({ where: { id: existing.id }, data: parsed.data });
    return NextResponse.json({ config });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
