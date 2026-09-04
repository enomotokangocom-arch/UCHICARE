import { NextRequest } from "next/server";
import { AnthropicNarrativeProvider, DecisionNarrativeInput } from "@/lib/ceo/aiProvider";

export const runtime = "nodejs";

interface ExplainRequestBody {
  decisions: DecisionNarrativeInput[];
}

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY が設定されていません。サーバーの環境変数を確認してください。" },
      { status: 500 }
    );
  }

  const { decisions } = (await request.json()) as ExplainRequestBody;

  if (!Array.isArray(decisions) || decisions.length === 0) {
    return Response.json({ error: "decisions が指定されていません。" }, { status: 400 });
  }
  if (decisions.length > 5) {
    return Response.json({ error: "一度に説明を生成できるDecisionは5件までです。" }, { status: 400 });
  }

  try {
    const provider = new AnthropicNarrativeProvider();
    const narratives = await provider.explainDecisions(decisions);
    return Response.json({ narratives });
  } catch (error) {
    const message = error instanceof Error ? error.message : "説明文の生成中にエラーが発生しました。";
    return Response.json({ error: message }, { status: 502 });
  }
}
