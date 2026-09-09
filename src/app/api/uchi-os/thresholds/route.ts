import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, assertRole, assertStationAccess } from "@/server/uchi-os/auth/rbac";
import { handleApiError, apiError } from "@/server/uchi-os/http";
import { prisma } from "@/server/uchi-os/db/client";
import { resolveThresholdsForRules, RULE_THRESHOLD_DEFAULTS } from "@/server/uchi-os/decision-engine/thresholds";

const ALL_RULE_CODES = Object.keys(RULE_THRESHOLD_DEFAULTS);

// 07章冒頭:「閾値をハードコードしすぎない。企業・拠点ごとに変更可能な設計にする」の編集UI用API。
export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const stationId = request.nextUrl.searchParams.get("stationId");
    assertStationAccess(session, stationId);

    const thresholds = await resolveThresholdsForRules(session.organizationId, stationId, ALL_RULE_CODES);
    return NextResponse.json({ thresholds, defaults: RULE_THRESHOLD_DEFAULTS });
  } catch (error) {
    return handleApiError(error);
  }
}

const patchSchema = z.object({
  stationId: z.string().nullable(),
  ruleCode: z.string().min(1),
  paramKey: z.string().min(1),
  value: z.number(),
});

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireSession();
    assertRole(session, ["OWNER", "ADMIN", "STATION_MANAGER"]);
    const body = patchSchema.parse(await request.json());
    assertStationAccess(session, body.stationId);

    if (!RULE_THRESHOLD_DEFAULTS[body.ruleCode] || !(body.paramKey in RULE_THRESHOLD_DEFAULTS[body.ruleCode])) {
      return apiError("VALIDATION_ERROR", "未知のルール/パラメータです", 400);
    }

    // AnomalyThresholdの複合UNIQUEはstationId=NULLを別値として扱う(Postgresの仕様)ため、
    // 組織全体(stationId=null)の上書きは findFirst→update/create で明示的に分岐する。
    const existing = await prisma.anomalyThreshold.findFirst({
      where: { organizationId: session.organizationId, stationId: body.stationId, ruleCode: body.ruleCode, paramKey: body.paramKey },
    });

    if (existing) {
      await prisma.anomalyThreshold.update({
        where: { id: existing.id },
        data: { paramValue: body.value, updatedByUserId: session.userId },
      });
    } else {
      await prisma.anomalyThreshold.create({
        data: {
          organizationId: session.organizationId,
          stationId: body.stationId,
          ruleCode: body.ruleCode,
          paramKey: body.paramKey,
          paramValue: body.value,
          updatedByUserId: session.userId,
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        organizationId: session.organizationId,
        userId: session.userId,
        action: "threshold.update",
        targetType: "AnomalyThreshold",
        targetId: `${body.stationId ?? "ORG"}:${body.ruleCode}:${body.paramKey}`,
        metadata: body,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return apiError("VALIDATION_ERROR", "入力内容を確認してください", 400);
    return handleApiError(error);
  }
}
