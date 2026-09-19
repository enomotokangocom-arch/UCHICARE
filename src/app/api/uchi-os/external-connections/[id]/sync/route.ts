import { NextRequest, NextResponse } from "next/server";
import { requireSession, assertRole } from "@/server/uchi-os/auth/rbac";
import { handleApiError, apiError } from "@/server/uchi-os/http";
import { syncExternalConnection, AdapterFetchError } from "@/server/uchi-os/import/adapter";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    assertRole(session, ["OWNER", "ADMIN"]);
    const { id } = await params;

    const { batchId, result } = await syncExternalConnection(session.organizationId, id);
    return NextResponse.json({ batchId, result });
  } catch (error) {
    if (error instanceof AdapterFetchError) return apiError("ADAPTER_FETCH_ERROR", error.message, 502);
    if (error instanceof Error && error.message === "ExternalConnectionが見つかりません") {
      return apiError("NOT_FOUND", error.message, 404);
    }
    return handleApiError(error);
  }
}
