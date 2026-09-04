import { DecisionNarrativeInput, DecisionNarrativeOutput } from "./aiProvider";
import { Decision } from "./types";

function toNarrativeInput(d: Decision): DecisionNarrativeInput {
  return {
    decisionId: d.decisionId,
    decisionType: d.decisionType,
    entityLabel: d.entityLabel,
    currentValue: d.currentValue,
    targetValue: d.targetValue,
    unit: d.unit,
    gap: d.gap,
    severity: d.severity,
    mainFactors: d.explain.mainFactors,
    confidenceScore: d.confidenceScore,
  };
}

async function requestNarratives(decisions: Decision[]): Promise<DecisionNarrativeOutput[]> {
  const response = await fetch("/api/ceo/explain", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ decisions: decisions.map(toNarrativeInput) }),
  });

  const rawText = await response.text();
  let data: unknown;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error(`予期しない応答(HTTP ${response.status})`);
  }
  if (!response.ok) {
    const message = (data as { error?: string })?.error ?? `HTTP ${response.status}`;
    throw new Error(message);
  }
  return (data as { narratives: DecisionNarrativeOutput[] }).narratives;
}

/**
 * DecisionにAI生成の説明文を付与する。LLM未設定・エラー時は Decision Engine が
 * 既に生成済みの決定的なテンプレート文(reasoningSummary/recommendedAction/expectedImpact)を
 * そのまま残し、aiNarrative を "fallback" のままにする(機能停止させない)。
 */
export async function enrichDecisionsWithAiNarrative(decisions: Decision[]): Promise<Decision[]> {
  if (decisions.length === 0) return decisions;

  try {
    const narratives = await requestNarratives(decisions);
    const byId = new Map(narratives.map((n) => [n.decisionId, n]));
    return decisions.map((d) => {
      const n = byId.get(d.decisionId);
      if (!n || !n.reasoningSummary) return { ...d, aiNarrative: "fallback" as const };
      return {
        ...d,
        reasoningSummary: n.reasoningSummary,
        recommendedAction: n.recommendedAction || d.recommendedAction,
        expectedImpact: n.expectedImpact || d.expectedImpact,
        aiNarrative: "generated" as const,
      };
    });
  } catch {
    return decisions.map((d) => ({ ...d, aiNarrative: "fallback" as const }));
  }
}
