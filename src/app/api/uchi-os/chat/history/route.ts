import { NextResponse } from "next/server";
import { requireSession } from "@/server/uchi-os/auth/rbac";
import { handleApiError } from "@/server/uchi-os/http";
import { prisma } from "@/server/uchi-os/db/client";

const HISTORY_LIMIT = 20;

export async function GET() {
  try {
    const session = await requireSession();
    const turns = await prisma.aIInsight.findMany({
      where: { organizationId: session.organizationId, kind: "CHAT_ANSWER" },
      orderBy: { createdAt: "desc" },
      take: HISTORY_LIMIT,
    });

    const messages = turns
      .slice()
      .reverse()
      .flatMap((turn) => {
        const input = turn.inputSummary as { question?: string } | null;
        if (!input?.question) return [];
        return [
          { role: "user" as const, text: input.question, createdAt: turn.createdAt },
          { role: "assistant" as const, text: turn.outputText, createdAt: turn.createdAt },
        ];
      });

    return NextResponse.json({ messages });
  } catch (error) {
    return handleApiError(error);
  }
}
