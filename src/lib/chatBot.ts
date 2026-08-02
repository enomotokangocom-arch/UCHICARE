import { categoryAggregates, departmentAggregates, overallScore } from "./aggregate";
import { RISK_LEVEL_JA } from "./scoring";
import { surveyDefs } from "./surveyDefs";
import { RiskLevel, SurveySubmission, SurveyType } from "./types";

export interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  text: string;
}

export const SUGGESTED_PROMPTS = [
  "営業部のストレス状況を教えて",
  "腰痛リスクが高い部署はどこ?",
  "介護と仕事の両立で困っている人はいる?",
  "労働環境で改善すべき点は?",
  "全体的な健康経営の課題をまとめて",
];

export interface ChatDataSummary {
  overallScore: number;
  categories: {
    type: SurveyType;
    label: string;
    averageScore: number;
    level: RiskLevel;
    levelLabel: string;
    responseCount: number;
    highRiskCount: number;
  }[];
  departments: {
    department: string;
    overallScore: number;
    responseCount: number;
    categoryScores: Partial<Record<SurveyType, number | null>>;
  }[];
}

/** チャットAPIに渡す、ダッシュボード集計データの要約を作成する。 */
export function buildDataSummary(submissions: SurveySubmission[]): ChatDataSummary {
  return {
    overallScore: overallScore(submissions),
    categories: categoryAggregates(submissions).map((c) => ({
      type: c.type,
      label: surveyDefs[c.type].shortTitle,
      averageScore: c.averageScore,
      level: c.level,
      levelLabel: RISK_LEVEL_JA[c.level],
      responseCount: c.responseCount,
      highRiskCount: c.highRiskCount,
    })),
    departments: departmentAggregates(submissions).map((d) => ({
      department: d.department,
      overallScore: d.overallScore,
      responseCount: d.responseCount,
      categoryScores: d.categoryScores,
    })),
  };
}

/** チャットAPIのシステムプロンプトを、ダッシュボードの集計データ要約から組み立てる。 */
export function buildSystemPrompt(summary: ChatDataSummary): string {
  return `あなたはUCHICAREの「健康経営アシスタント」です。保健師・療法士・ケアマネジャーが監修する企業向け健康経営ツールの一部として、企業担当者からの質問に日本語で回答します。

以下は現在のダッシュボードの集計データ(JSON形式)です。回答は必ずこのデータの範囲内で行い、データにない数値や事実を創作しないでください。データが不足している場合は、その旨を正直に伝えてください。

\`\`\`json
${JSON.stringify(summary, null, 2)}
\`\`\`

補足:
- スコアは0〜100点で、100点が最も良好(低リスク)です。70点以上が低リスク、40〜69点が中リスク、40点未満が高リスクの目安です。
- 4つの指標: ergonomics(労働環境/エルゴノミクス評価)、stressCheck(ミニストレスチェック)、backPain(腰痛リスク調査)、caregiving(介護リスク調査/ビジネスケアラー)。

回答方針:
- 簡潔に、具体的な数値を交えて答えてください。
- 可能であれば、保健師・療法士・ケアマネジャーの視点から現実的な改善提案を添えてください。
- 個人が特定されるような踏み込んだ質問には答えず、部署・組織単位の傾向として回答してください。
- 日本語のビジネス文書として自然な、丁寧な文体で回答してください。`;
}
