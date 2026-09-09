// LLM Reasoning Layer への唯一の入口 (08章・14章リポジトリ構成の方針: この配下以外から
// Anthropic SDKを直接importしない)。Calculation/KPI/Rule/Forecast Engineは一切ここを経由しない。

import Anthropic from "@anthropic-ai/sdk";

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let cachedClient: Anthropic | null = null;
function getClient(): Anthropic {
  if (!cachedClient) cachedClient = new Anthropic();
  return cachedClient;
}

export interface GenerateTextOptions {
  system: string;
  prompt: string;
  model?: string;
  maxTokens?: number;
}

/**
 * 非ストリーミングのテキスト生成。バッチ的な用途(原因説明の事前生成等)に使う。
 * ANTHROPIC_API_KEY未設定、またはAPI呼び出し失敗時は null を返す
 * (04.4節: LLM Reasoning Layerが失敗してもCalculation〜Rule Engineの結果は表示できる)。
 */
export async function generateText({
  system,
  prompt,
  model = "claude-sonnet-5",
  maxTokens = 700,
}: GenerateTextOptions): Promise<string | null> {
  if (!isAiConfigured()) return null;
  try {
    const response = await getClient().messages.create({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: prompt }],
    });
    const textBlock = response.content.find((block) => block.type === "text");
    return textBlock && "text" in textBlock ? textBlock.text : null;
  } catch (error) {
    console.error("[uchi-os] Claude API call failed:", error);
    return null;
  }
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** チャット用のストリーミング呼び出し。ANTHROPIC_API_KEY未設定時は null を返す。 */
export function streamChat(options: { system: string; messages: ChatMessage[]; model?: string; maxTokens?: number }) {
  if (!isAiConfigured()) return null;
  const { system, messages, model = "claude-opus-5", maxTokens = 1500 } = options;
  return getClient().messages.stream({ model, max_tokens: maxTokens, system, messages });
}
