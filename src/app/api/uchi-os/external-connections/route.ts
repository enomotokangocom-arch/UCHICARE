import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, assertRole } from "@/server/uchi-os/auth/rbac";
import { handleApiError, apiError } from "@/server/uchi-os/http";
import { prisma } from "@/server/uchi-os/db/client";
import { encryptSecret } from "@/server/uchi-os/security/encryption";
import { IMPORT_ENTITIES } from "@/server/uchi-os/import/schemas";

// authTokenEncrypted はAPIレスポンスに含めない(09章 Secret Management)。
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

export async function GET() {
  try {
    const session = await requireSession();
    assertRole(session, ["OWNER", "ADMIN"]);

    const connections = await prisma.externalConnection.findMany({
      where: { organizationId: session.organizationId },
      select: CONNECTION_SELECT,
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ connections });
  } catch (error) {
    return handleApiError(error);
  }
}

const createSchema = z.object({
  name: z.string().min(1).max(200),
  targetEntity: z.enum(IMPORT_ENTITIES),
  baseUrl: z.string().url(),
  authHeaderName: z.string().min(1).max(100).optional(),
  authToken: z.string().min(1).max(2000).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    assertRole(session, ["OWNER", "ADMIN"]);

    const body = createSchema.parse(await request.json());
    if (body.authHeaderName && !body.authToken) {
      return apiError("VALIDATION_ERROR", "authHeaderNameを指定する場合はauthTokenも必要です", 400);
    }

    const connection = await prisma.externalConnection.create({
      data: {
        organizationId: session.organizationId,
        createdByUserId: session.userId,
        name: body.name,
        targetEntity: body.targetEntity,
        baseUrl: body.baseUrl,
        authHeaderName: body.authHeaderName ?? null,
        authTokenEncrypted: body.authToken ? new Uint8Array(encryptSecret(body.authToken)) : null,
      },
      select: CONNECTION_SELECT,
    });
    return NextResponse.json({ connection }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return apiError("VALIDATION_ERROR", "入力内容を確認してください", 400);
    return handleApiError(error);
  }
}
