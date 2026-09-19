import { NextResponse } from "next/server";
import { prisma } from "@/lib/crm/prisma";
import { requireSession, apiErrorResponse } from "@/lib/crm/session";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const session = await requireSession({ requireWrite: true });
    const { id } = await params;
    const notification = await prisma.notification.update({
      where: { id },
      data: { readAt: new Date(), readByStaffId: session.staffId },
    });
    return NextResponse.json({ notification });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
