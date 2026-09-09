import { NextResponse } from "next/server";
import { requireSession } from "@/server/uchi-os/auth/rbac";
import { handleApiError, apiError } from "@/server/uchi-os/http";
import { prisma } from "@/server/uchi-os/db/client";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const scenario = await prisma.scenario.findFirst({ where: { id, organizationId: session.organizationId } });
    if (!scenario) return apiError("NOT_FOUND", "Scenarioが見つかりません", 404);
    return NextResponse.json({ scenario });
  } catch (error) {
    return handleApiError(error);
  }
}
