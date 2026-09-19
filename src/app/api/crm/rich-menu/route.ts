import { NextResponse } from "next/server";
import { prisma } from "@/lib/crm/prisma";
import { requireSession, apiErrorResponse } from "@/lib/crm/session";

export async function GET() {
  try {
    await requireSession();
    const menus = await prisma.richMenuConfig.findMany({ orderBy: { slot: "asc" } });
    return NextResponse.json({ menus });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
