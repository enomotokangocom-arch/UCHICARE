import { NextResponse } from "next/server";
import { prisma } from "@/lib/crm/prisma";
import { requireSession, apiErrorResponse } from "@/lib/crm/session";

export async function GET(request: Request) {
  try {
    await requireSession();
    const url = new URL(request.url);
    const status = url.searchParams.get("status");

    const notifications = await prisma.notification.findMany({
      where: status === "unread" ? { readAt: null } : undefined,
      include: { candidate: { select: { id: true, name: true, lineDisplayName: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ notifications });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
