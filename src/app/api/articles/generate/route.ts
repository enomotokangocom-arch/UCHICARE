import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { buildArticleSystemPrompt, buildArticleUserPrompt, parseGeneratedArticle } from "@/lib/articleGenerator";
import { ArticleGenerationInput } from "@/lib/articleTypes";

export const runtime = "nodejs";

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
      max_tokens: 4096,
      output_config: { effort: "medium" },
      system: buildArticleSystemPrompt(),
      messages: [{ role: "user", content: buildArticleUserPrompt(input) }],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return Response.json({ error: "記事の生成に失敗しました。もう一度お試しください。" }, { status: 502 });
    }

    const article = parseGeneratedArticle(textBlock.text);
    return Response.json(article);
  } catch (error) {
    const message = error instanceof Error ? error.message : "記事の生成中にエラーが発生しました。";
    return Response.json({ error: message }, { status: 502 });
  }
}
