import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, assertRole } from "@/server/uchi-os/auth/rbac";
import { handleApiError, apiError } from "@/server/uchi-os/http";
import { prisma } from "@/server/uchi-os/db/client";

const NOTIFICATION_SELECT = {
  slackWebhookUrl: true,
  notifyOnCriticalAlert: true,
  dailyDigestEnabled: true,
  digestEmailRecipients: true,
} as const;

export async function GET() {
  try {
    const session = await requireSession();
    const organization = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: NOTIFICATION_SELECT,
    });
    return NextResponse.json({ notifications: organization });
  } catch (error) {
    return handleApiError(error);
  }
}

const patchSchema = z.object({
  slackWebhookUrl: z.string().url().nullable().optional(),
  notifyOnCriticalAlert: z.boolean().optional(),
  dailyDigestEnabled: z.boolean().optional(),
  digestEmailRecipients: z.array(z.string().email()).max(20).optional(),
});

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireSession();
    assertRole(session, ["OWNER", "ADMIN"]);

    const body = patchSchema.parse(await request.json());
    const organization = await prisma.organization.update({
      where: { id: session.organizationId },
      data: body,
      select: NOTIFICATION_SELECT,
    });
    return NextResponse.json({ notifications: organization });
  } catch (error) {
    if (error instanceof z.ZodError) return apiError("VALIDATION_ERROR", "入力内容を確認してください", 400);
    return handleApiError(error);
  }
}
