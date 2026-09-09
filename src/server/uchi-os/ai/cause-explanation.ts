import { prisma } from "@/server/uchi-os/db/client";
import { generateText } from "./client";
import { buildCauseExplanationPrompt } from "./prompts";
import { sanitizeDecisionForPrompt } from "./sanitizer";
import type { Prisma } from "@prisma/client";

const MODEL = "claude-sonnet-5";

export interface CauseExplanationResult {
  outputText: string;
  confidence: number | null;
  model: string;
  createdAt: Date;
}

/**
 * Decisionの原因説明(AIInsight kind=CAUSE_EXPLANATION)を取得する。
 * 既に生成済みならキャッシュを返し、無ければその場で生成して保存する
 * (CEO Morning/Decision Engineの主経路をLLM呼び出しでブロックしないよう、
 * オンデマンド — ユーザーが「AI分析を見る」を開いた時点で初めて呼ばれる、04.5節)。
 */
export async function getOrCreateCauseExplanation(
  organizationId: string,
  decisionId: string,
): Promise<CauseExplanationResult | null> {
  const existing = await prisma.aIInsight.findFirst({
    where: { organizationId, decisionId, kind: "CAUSE_EXPLANATION" },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    return { outputText: existing.outputText, confidence: existing.confidence, model: existing.model, createdAt: existing.createdAt };
  }

  const decision = await prisma.decision.findFirst({
    where: { id: decisionId, organizationId },
    include: { station: { select: { name: true } } },
  });
  if (!decision) return null;

  const employeeNames = await prisma.employee.findMany({ where: { organizationId }, select: { name: true } });

  const sanitized = sanitizeDecisionForPrompt(
    decision,
    decision.station?.name ?? "法人全体",
    employeeNames.map((e) => e.name),
  );
  const { system, prompt } = buildCauseExplanationPrompt(sanitized);
  const outputText = await generateText({ system, prompt, model: MODEL, maxTokens: 500 });
  if (!outputText) return null; // ANTHROPIC_API_KEY未設定、またはAPI呼び出し失敗

  const insight = await prisma.aIInsight.create({
    data: {
      organizationId,
      decisionId,
      kind: "CAUSE_EXPLANATION",
      inputSummary: sanitized as unknown as Prisma.InputJsonValue,
      outputText,
      model: MODEL,
      confidence: decision.confidence,
    },
  });

  return { outputText: insight.outputText, confidence: insight.confidence, model: insight.model, createdAt: insight.createdAt };
}
