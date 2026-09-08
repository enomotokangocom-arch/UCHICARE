import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/server/uchi-os/auth/rbac";
import { handleApiError } from "@/server/uchi-os/http";
import { getCeoMorningData } from "@/server/uchi-os/ceo-morning";
import { formatYearMonth } from "@/server/uchi-os/kpi-engine/dates";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const yearMonth = request.nextUrl.searchParams.get("yearMonth") ?? formatYearMonth(new Date());
    const data = await getCeoMorningData(session.organizationId, yearMonth);
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}
