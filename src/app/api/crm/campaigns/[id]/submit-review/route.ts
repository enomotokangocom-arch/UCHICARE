import { NextResponse } from "next/server";
import { prisma } from "@/lib/crm/prisma";
import { requireSession, apiErrorResponse } from "@/lib/crm/session";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    await requireSession({ requireWrite: true });
    const { id } = await params;
    const existing = await prisma.campaign.findUniqueOrThrow({ where: { id } });
    if (existing.status !== "DRAFT") {
      return NextResponse.json({ error: "下書き状態のキャンペーンのみレビューに提出できます。" }, { status: 409 });
    }
    const campaign = await prisma.campaign.update({ where: { id }, data: { status: "REVIEW" } });
    return NextResponse.json({ campaign });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
