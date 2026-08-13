import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { buildArticleSystemPrompt, buildArticleUserPrompt, parseGeneratedArticle } from "@/lib/articleGenerator";
import { ArticleGenerationInput } from "@/lib/articleTypes";

export const runtime = "nodejs";
// Claude Opusでの記事生成は数十秒かかることがあり、Vercelのデフォルトのタイムアウト(短い場合10秒)
// では打ち切られてしまうため、明示的に上限を延長する(Hobbyプランでの上限は60秒)。
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY が設定されていません。サーバーの環境変数を確認してください。" },
      { status: 500 }
    );
  }

  const input = (await request.json()) as ArticleGenerationInput;

  if (!input.mainKeyword || !input.mainKeyword.trim()) {
    return Response.json({ error: "メインキーワードを入力してください。" }, { status: 400 });
  }

  const client = new Anthropic();

  try {
    const message = await client.messages.create({
      model: "claude-opus-5",
      // JSON構造(タイトル・見出し・本文・キーワード等)を含めると、特に長めの記事カテゴリで
      // 4096トークンでは出力が途中で切れてJSONが壊れることがあったため、余裕を持たせている。
      max_tokens: 8192,
      output_config: { effort: "low" },
      system: buildArticleSystemPrompt(),
      messages: [{ role: "user", content: buildArticleUserPrompt(input) }],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return Response.json({ error: "記事の生成に失敗しました。もう一度お試しください。" }, { status: 502 });
    }

    if (message.stop_reason === "max_tokens") {
      return Response.json(
        { error: "生成された記事が長すぎたため途中で切れてしまいました。文字数の目安を短くして、もう一度お試しください。" },
        { status: 502 }
      );
    }

    const article = parseGeneratedArticle(textBlock.text);
    return Response.json(article);
  } catch (error) {
    const message = error instanceof Error ? error.message : "記事の生成中にエラーが発生しました。";
    return Response.json({ error: message }, { status: 502 });
  }
}
