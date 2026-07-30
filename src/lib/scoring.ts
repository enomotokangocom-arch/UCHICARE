import { RiskLevel, SurveyDef } from "./types";

/** score >= 70: low(良好), score >= 40: medium(要注意), それ未満: high(要改善/高リスク) */
export const LEVEL_THRESHOLDS = { low: 70, medium: 40 } as const;

export function scoreToLevel(score: number): RiskLevel {
  if (score >= LEVEL_THRESHOLDS.low) return "low";
  if (score >= LEVEL_THRESHOLDS.medium) return "medium";
  return "high";
}

/**
 * 各設問の回答(1〜4)を、極性(polarity)に応じて「健康的であるほど高い」0〜100の
 * スコアに変換し、平均を取る。
 * positive: 4=100点, 1=0点 / negative: 1=100点, 4=0点
 */
export function calculateSurveyScore(surveyDef: SurveyDef, answers: number[]): number {
  const components = surveyDef.questions.map((question, index) => {
    const raw = answers[index];
    if (question.polarity === "positive") {
      return ((raw - 1) / 3) * 100;
    }
    return ((4 - raw) / 3) * 100;
  });
  const total = components.reduce((sum, value) => sum + value, 0);
  return Math.round(total / components.length);
}

export const RISK_LEVEL_ORDER: RiskLevel[] = ["low", "medium", "high"];

export const RISK_LEVEL_COLOR: Record<RiskLevel, string> = {
  low: "#16a34a",
  medium: "#d97706",
  high: "#dc2626",
};

export const RISK_LEVEL_JA: Record<RiskLevel, string> = {
  low: "低リスク",
  medium: "中リスク",
  high: "高リスク",
};
