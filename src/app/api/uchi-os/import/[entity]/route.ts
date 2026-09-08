import { NextRequest, NextResponse } from "next/server";
import { requireSession, assertRole } from "@/server/uchi-os/auth/rbac";
import { handleApiError, apiError } from "@/server/uchi-os/http";
import { prisma } from "@/server/uchi-os/db/client";
import { runImport } from "@/server/uchi-os/import/importers";
import { IMPORT_ENTITIES, type ImportEntity } from "@/server/uchi-os/import/schemas";

export async function POST(request: NextRequest, { params }: { params: Promise<{ entity: string }> }) {
  try {
    const session = await requireSession();
    assertRole(session, ["OWNER", "ADMIN", "FINANCE"]);

    const { entity } = await params;
    if (!IMPORT_ENTITIES.includes(entity as ImportEntity)) {
      return apiError("UNKNOWN_ENTITY", `未対応のentityです: ${entity}`, 400);
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return apiError("VALIDATION_ERROR", "fileが指定されていません", 400);
    }
    const csvText = await file.text();

    const batch = await prisma.dataImportBatch.create({
      data: {
        organizationId: session.organizationId,
        uploadedByUserId: session.userId,
        targetEntity: entity,
        fileName: file.name,
        status: "PROCESSING",
      },
    });

    try {
      const result = await runImport(session.organizationId, entity as ImportEntity, csvText);
      const completed = await prisma.dataImportBatch.update({
        where: { id: batch.id },
        data: {
          status: result.errorCount > 0 ? (result.errorCount === result.rowCount ? "FAILED" : "PARTIAL") : "SUCCEEDED",
          rowCount: result.rowCount,
          errorCount: result.errorCount,
          errorDetail: result.errors,
          completedAt: new Date(),
        },
      });
      return NextResponse.json({ batch: completed, result });
    } catch (error) {
      await prisma.dataImportBatch.update({
        where: { id: batch.id },
        data: { status: "FAILED", errorDetail: { message: String(error) }, completedAt: new Date() },
      });
      throw error;
    }
  } catch (error) {
    return handleApiError(error);
  }
}
