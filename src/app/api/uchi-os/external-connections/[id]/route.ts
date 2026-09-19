import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, assertRole } from "@/server/uchi-os/auth/rbac";
import { handleApiError, apiError } from "@/server/uchi-os/http";
import { prisma } from "@/server/uchi-os/db/client";
import { encryptSecret } from "@/server/uchi-os/security/encryption";

const CONNECTION_SELECT = {
  id: true,
  name: true,
  targetEntity: true,
  connectorType: true,
  baseUrl: true,
  authHeaderName: true,
  status: true,
  lastSyncedAt: true,
  lastSyncStatus: true,
  lastSyncError: true,
  createdAt: true,
  updatedAt: true,
} as const;

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  baseUrl: z.string().url().optional(),
  authHeaderName: z.string().min(1).max(100).nullable().optional(),
  authToken: z.string().min(1).max(2000).optional(), // 指定時のみトークンをローテーションする
  status: z.enum(["ACTIVE", "PAUSED"]).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    assertRole(session, ["OWNER", "ADMIN"]);
    const { id } = await params;

    const existing = await prisma.externalConnection.findFirst({ where: { id, organizationId: session.organizationId } });
    if (!existing) return apiError("NOT_FOUND", "ExternalConnectionが見つかりません", 404);

    const body = patchSchema.parse(await request.json());
    const connection = await prisma.externalConnection.update({
      where: { id },
      data: {
        name: body.name,
        baseUrl: body.baseUrl,
        authHeaderName: body.authHeaderName,
        authTokenEncrypted: body.authToken ? new Uint8Array(encryptSecret(body.authToken)) : undefined,
        status: body.status,
      },
      select: CONNECTION_SELECT,
    });
    return NextResponse.json({ connection });
  } catch (error) {
    if (error instanceof z.ZodError) return apiError("VALIDATION_ERROR", "入力内容を確認してください", 400);
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    assertRole(session, ["OWNER", "ADMIN"]);
    const { id } = await params;

    const existing = await prisma.externalConnection.findFirst({ where: { id, organizationId: session.organizationId } });
    if (!existing) return apiError("NOT_FOUND", "ExternalConnectionが見つかりません", 404);

    await prisma.externalConnection.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
