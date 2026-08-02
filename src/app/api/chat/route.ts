import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { buildSystemPrompt, ChatDataSummary } from "@/lib/chatBot";

export const runtime = "nodejs";

interface ChatRequestBody {
  messages: { role: "user" | "assistant"; text: string }[];
  summary: ChatDataSummary;
}

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response("ANTHROPIC_API_KEY が設定されていません。サーバーの環境変数を確認してください。", {
      status: 500,
    });
  }

  const { messages, summary } = (await request.json()) as ChatRequestBody;

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response("メッセージが指定されていません。", { status: 400 });
  }

  const client = new Anthropic();

  const stream = client.messages.stream({
    model: "claude-opus-5",
    max_tokens: 2048,
    output_config: { effort: "low" },
    system: buildSystemPrompt(summary),
    messages: messages.map((m) => ({ role: m.role, content: m.text })),
  });

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      stream.on("text", (delta) => {
        controller.enqueue(encoder.encode(delta));
      });
      try {
        await stream.finalMessage();
      } catch (error) {
        controller.error(error);
        return;
      }
      controller.close();
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
