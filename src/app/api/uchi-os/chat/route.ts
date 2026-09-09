import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession } from "@/server/uchi-os/auth/rbac";
import { prisma } from "@/server/uchi-os/db/client";
import { isAiConfigured, streamChat, type ChatMessage } from "@/server/uchi-os/ai/client";
import { buildChatSystemPrompt, buildChatContextMessage } from "@/server/uchi-os/ai/prompts";
import { buildChatContext } from "@/server/uchi-os/ai/chat-context";
import { formatYearMonth } from "@/server/uchi-os/kpi-engine/dates";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

const bodySchema = z.object({ message: z.string().min(1).max(2000) });
const HISTORY_TURNS = 6;
const MODEL = "claude-opus-5";

// 12章 AI経営参謀チャット。08章のLLM Reasoning Layerを通じて、KPI/Decisionのスナップショットを
// 根拠データとして渡し、結論→根拠→数値→リスク→推奨Actionの順で回答させる。
export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return new Response("ログインが必要です。", { status: 401 });
  }

  if (!isAiConfigured()) {
    return new Response(
      "ANTHROPIC_API_KEY が設定されていないため、AI経営参謀チャットは利用できません。サーバーの環境変数を確認してください。",
      { status: 500 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return new Response("メッセージを入力してください。", { status: 400 });
  }
  const { message } = parsed.data;

  const organizationId = session.organizationId;
  const yearMonth = formatYearMonth(new Date());

  const [pastTurns, context] = await Promise.all([
    prisma.aIInsight.findMany({
      where: { organizationId, kind: "CHAT_ANSWER" },
      orderBy: { createdAt: "desc" },
      take: HISTORY_TURNS,
    }),
    buildChatContext(organizationId, yearMonth),
  ]);

  const history: ChatMessage[] = pastTurns
    .slice()
    .reverse()
    .flatMap((turn): ChatMessage[] => {
      const input = turn.inputSummary as { question?: string } | null;
      if (!input?.question) return [];
      return [
        { role: "user", content: input.question },
        { role: "assistant", content: turn.outputText },
      ];
    });

  const system = `${buildChatSystemPrompt()}\n\n${buildChatContextMessage(context)}`;
  const messages: ChatMessage[] = [...history, { role: "user", content: message }];

  const stream = streamChat({ system, messages, model: MODEL, maxTokens: 1200 });
  if (!stream) {
    return new Response("AI経営参謀チャットの呼び出しに失敗しました。", { status: 500 });
  }

  const encoder = new TextEncoder();
  let accumulated = "";
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      stream.on("text", (delta) => {
        accumulated += delta;
        controller.enqueue(encoder.encode(delta));
      });
      try {
        await stream.finalMessage();
      } catch (error) {
        controller.error(error);
        return;
      }

      if (accumulated.trim()) {
        await prisma.aIInsight.create({
          data: {
            organizationId,
            kind: "CHAT_ANSWER",
            inputSummary: { question: message } as unknown as Prisma.InputJsonValue,
            outputText: accumulated,
            model: MODEL,
          },
        });
      }

      controller.close();
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
