import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/server/uchi-os/auth/rbac";
import { handleApiError, apiError } from "@/server/uchi-os/http";
import { IMPORT_ENTITIES, IMPORT_TEMPLATES, type ImportEntity } from "@/server/uchi-os/import/schemas";

export async function GET(request: NextRequest, { params }: { params: Promise<{ entity: string }> }) {
  try {
    await requireSession();
    const { entity } = await params;
    if (!IMPORT_ENTITIES.includes(entity as ImportEntity)) {
      return apiError("UNKNOWN_ENTITY", `未対応のentityです: ${entity}`, 400);
    }
    return new NextResponse(IMPORT_TEMPLATES[entity as ImportEntity], {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${entity}_template.csv"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
