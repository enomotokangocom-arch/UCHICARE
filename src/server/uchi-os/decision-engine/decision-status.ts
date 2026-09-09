import { prisma } from "@/server/uchi-os/db/client";

/**
 * 人間がActionに対して何らかの操作(承認/修正/保留/却下/実績記録)を行った際に、
 * 親Decisionを HUMAN_REVIEWED へ遷移させる。DISMISSED済みのDecisionは変更しない。
 */
export async function markDecisionReviewed(decisionId: string): Promise<void> {
  await prisma.decision.updateMany({
    where: { id: decisionId, status: { in: ["DRAFT", "AI_RECOMMENDED"] } },
    data: { status: "HUMAN_REVIEWED" },
  });
}
