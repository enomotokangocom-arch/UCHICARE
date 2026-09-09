import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, assertStationAccess } from "@/server/uchi-os/auth/rbac";
import { handleApiError, apiError } from "@/server/uchi-os/http";
import { prisma } from "@/server/uchi-os/db/client";
import { scenarioRequestSchema } from "@/server/uchi-os/scenario-engine/schema";
import { runScenario } from "@/server/uchi-os/scenario-engine/simulate";
import { formatYearMonth } from "@/server/uchi-os/kpi-engine/dates";
import type { Prisma } from "@prisma/client";
import type { ScenarioParamsByType, ScenarioType } from "@/server/uchi-os/scenario-engine/types";

export async function GET() {
  try {
    const session = await requireSession();
    const scenarios = await prisma.scenario.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({ scenarios });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = scenarioRequestSchema.parse(await request.json());
    assertStationAccess(session, body.stationId);

    const yearMonth = formatYearMonth(new Date());
    const comparison = await runScenario(
      session.organizationId,
      body.stationId,
      yearMonth,
      body.type as ScenarioType,
      body.params as ScenarioParamsByType[ScenarioType],
    );

    const scenario = await prisma.scenario.create({
      data: {
        organizationId: session.organizationId,
        createdByUserId: session.userId,
        name: body.name,
        inputParams: { stationId: body.stationId, type: body.type, params: body.params } as unknown as Prisma.InputJsonValue,
        resultSummary: comparison as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({ scenario });
  } catch (error) {
    if (error instanceof z.ZodError) return apiError("VALIDATION_ERROR", "入力内容を確認してください", 400);
    return handleApiError(error);
  }
}
