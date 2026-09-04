/**
 * LLM Provider abstraction。数値計算には一切使わず、Decisionの文章生成(要約・原因説明・
 * 推奨Actionの文章化)にのみ用いる(05-ai-agent.md)。特定モデルへのロックインを避けるため、
 * `@anthropic-ai/sdk` への依存はこのファイルに閉じ込める。サーバー専用(APIルートからのみ import)。
 */
import Anthropic from "@anthropic-ai/sdk";

export interface DecisionNarrativeInput {
  decisionId: string;
  decisionType: string;
  entityLabel: string;
  currentValue: number;
  targetValue: number;
  unit: string;
  gap: number;
  severity: "green" | "yellow" | "red";
  mainFactors: { label: string; contribution: number }[];
  confidenceScore: number;
}

export interface DecisionNarrativeOutput {
  decisionId: string;
  reasoningSummary: string;
  recommendedAction: string;
  expectedImpact: string;
}

export interface AiNarrativeProvider {
  explainDecisions(input: DecisionNarrativeInput[]): Promise<DecisionNarrativeOutput[]>;
}

function buildSystemPrompt(): string {
  return `あなたは訪問看護事業を運営する${"株式会社Uchi care"}の経営アドバイザーAIです。
渡された集計値(現状値・目標値・Gap・主要因の内訳)のみを根拠に、経営者向けの簡潔な説明文を生成してください。

厳守事項:
- 与えられた数値以外の数値を創作・誇張しないこと(円やパーセントの値は入力の数値のみを使うこと)
- 個人が特定される情報を含めないこと(拠点名レベルの粒度に留める)
- 断定的すぎる表現を避け、あくまで「提案」であることが伝わる文体にすること
- 採用・懲戒・医療判断などの最終判断はAIが行わず、人間が行うことを前提にした文体にすること

出力は必ず以下のJSON配列のみを返すこと。前後の説明文やコードブロックは不要です。

[
  { "decisionId": "...", "reasoningSummary": "状況と原因の要約(100文字程度)", "recommendedAction": "推奨アクション(80文字程度)", "expectedImpact": "期待効果(40文字程度)" }
]`;
}

function buildUserPrompt(input: DecisionNarrativeInput[]): string {
  return `以下のDecision一覧について、それぞれ説明文を生成してください。\n\n${JSON.stringify(input, null, 2)}`;
}

function parseNarrativeOutput(rawText: string): DecisionNarrativeOutput[] {
  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("説明文の生成結果を解析できませんでした。");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("説明文の生成結果の形式が不正です。");
  }
  return parsed
    .filter((p): p is Record<string, unknown> => typeof p === "object" && p !== null)
    .map((p) => ({
      decisionId: typeof p.decisionId === "string" ? p.decisionId : "",
      reasoningSummary: typeof p.reasoningSummary === "string" ? p.reasoningSummary : "",
      recommendedAction: typeof p.recommendedAction === "string" ? p.recommendedAction : "",
      expectedImpact: typeof p.expectedImpact === "string" ? p.expectedImpact : "",
    }))
    .filter((p) => p.decisionId);
}

export class AnthropicNarrativeProvider implements AiNarrativeProvider {
  async explainDecisions(input: DecisionNarrativeInput[]): Promise<DecisionNarrativeOutput[]> {
    const client = new Anthropic();

    const message = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 2048,
      output_config: { effort: "low" },
      system: buildSystemPrompt(),
      messages: [{ role: "user", content: buildUserPrompt(input) }],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("説明文の生成に失敗しました。");
    }
    return parseNarrativeOutput(textBlock.text);
  }
}
