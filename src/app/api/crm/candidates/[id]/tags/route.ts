import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/crm/prisma";
import { requireSession, apiErrorResponse } from "@/lib/crm/session";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const schema = z.object({ tagId: z.string() });

export async function POST(request: Request, { params }: RouteParams) {
  try {
    await requireSession({ requireWrite: true });
    const { id } = await params;
    const json = await request.json().catch(() => null);
    const parsed = schema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: "タグが不正です。" }, { status: 400 });

    await prisma.candidateTag.upsert({
      where: { candidateId_tagId: { candidateId: id, tagId: parsed.data.tagId } },
      update: {},
      create: { candidateId: id, tagId: parsed.data.tagId },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    await requireSession({ requireWrite: true });
    const { id } = await params;
    const url = new URL(request.url);
    const tagId = url.searchParams.get("tagId");
    if (!tagId) return NextResponse.json({ error: "tagIdが必要です。" }, { status: 400 });

    await prisma.candidateTag.deleteMany({ where: { candidateId: id, tagId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
