import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/server/uchi-os/auth/rbac";
import { handleApiError, apiError } from "@/server/uchi-os/http";
import { prisma } from "@/server/uchi-os/db/client";
import { getOrCreateCauseExplanation } from "@/server/uchi-os/ai/cause-explanation";
import { isAiConfigured } from "@/server/uchi-os/ai/client";

// 08章 LLM Reasoning Layer: Decisionの原因を自然文で説明する(AI ESTIMATE)。
// オンデマンド生成のため、CEO Morningの表示速度には影響しない。
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;

    const decision = await prisma.decision.findFirst({ where: { id, organizationId: session.organizationId } });
    if (!decision) return apiError("NOT_FOUND", "Decisionが見つかりません", 404);

    if (!isAiConfigured()) {
      return NextResponse.json({ available: false, reason: "ANTHROPIC_API_KEYが設定されていません" });
    }

    const result = await getOrCreateCauseExplanation(session.organizationId, id);
    if (!result) {
      return NextResponse.json({ available: false, reason: "AI分析の生成に失敗しました" });
    }

    return NextResponse.json({ available: true, ...result });
  } catch (error) {
    return handleApiError(error);
  }
}
