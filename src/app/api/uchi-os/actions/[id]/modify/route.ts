import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/server/uchi-os/auth/rbac";
import { handleApiError, apiError } from "@/server/uchi-os/http";
import { prisma } from "@/server/uchi-os/db/client";

const modifySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(2000).optional(),
  ownerUserId: z.string().nullable().optional(),
  deadline: z.string().datetime().nullable().optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const body = modifySchema.parse(await request.json());

    const action = await prisma.action.findFirst({ where: { id, organizationId: session.organizationId } });
    if (!action) return apiError("NOT_FOUND", "Actionが見つかりません", 404);

    const updated = await prisma.action.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.ownerUserId !== undefined ? { ownerUserId: body.ownerUserId } : {}),
        ...(body.deadline !== undefined ? { deadline: body.deadline ? new Date(body.deadline) : null } : {}),
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: session.organizationId,
        userId: session.userId,
        action: "action.modify",
        targetType: "Action",
        targetId: id,
        metadata: body,
      },
    });

    return NextResponse.json({ action: updated });
  } catch (error) {
    if (error instanceof z.ZodError) return apiError("VALIDATION_ERROR", "入力内容を確認してください", 400);
    return handleApiError(error);
  }
}
