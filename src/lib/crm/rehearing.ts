import { prisma } from "./prisma";
import { pushMessage } from "./line/client";
import { recordCandidateEvent, createNotification } from "./events";
import { TRANSFER_TIMING_LABELS, REHEARING_RESEARCH_DAYS, REHEARING_6_12M_DAYS, NOTIFICATION_TYPES } from "./constants";

const DAY_MS = 24 * 60 * 60 * 1000;

const TIMING_OPTIONS = Object.entries(TRANSFER_TIMING_LABELS).map(([code, label]) => ({ code, label }));

export interface RehearingRunResult {
  targeted: number;
  sent: number;
  errors: number;
}

/**
 * 「情報収集中」「半年〜1年以内」の候補者に対し、一定期間ごとに転職意向を再確認します。
 * 過去の回答は上書きせず CandidateEvent (REHEARING_ANSWER) に履歴として保持されます。
 */
export async function runRehearingCheck(): Promise<RehearingRunResult> {
  const result: RehearingRunResult = { targeted: 0, sent: 0, errors: 0 };

  const targets = await prisma.candidate.findMany({
    where: {
      isBlocked: false,
      deletedAt: null,
      lineUserId: { not: null },
      transferTiming: { in: ["TIME_RESEARCH", "TIME_6_12M"] },
      stage: "NURTURING",
    },
  });

  const now = Date.now();

  for (const candidate of targets) {
    const thresholdDays = candidate.transferTiming === "TIME_RESEARCH" ? REHEARING_RESEARCH_DAYS : REHEARING_6_12M_DAYS;
    const baseline = candidate.lastRehearingSentAt ?? candidate.registeredAt;
    const elapsedDays = (now - baseline.getTime()) / DAY_MS;
    if (elapsedDays < thresholdDays) continue;

    result.targeted += 1;
    if (!candidate.lineUserId) continue;

    try {
      await pushMessage(candidate.lineUserId, [
        {
          type: "text",
          text: `以前、転職について「${TRANSFER_TIMING_LABELS[candidate.transferTiming!]}」と回答いただきましたが、現在のお気持ちに近いものを教えてください。`,
          quickReply: {
            items: TIMING_OPTIONS.map((t) => ({
              type: "action",
              action: { type: "postback", label: t.label.slice(0, 20), data: `REHEARING:${t.code}`, displayText: t.label },
            })),
          },
        },
      ]);

      await prisma.candidate.update({ where: { id: candidate.id }, data: { lastRehearingSentAt: new Date() } });
      await recordCandidateEvent({
        candidateId: candidate.id,
        type: "REHEARING_SENT",
        label: "再ヒアリング送信",
      });
      await createNotification({
        type: NOTIFICATION_TYPES.REHEARING_DUE,
        candidateId: candidate.id,
        title: "再ヒアリングを送信しました",
      });
      result.sent += 1;
    } catch (err) {
      result.errors += 1;
      console.error("Rehearing send failed", err instanceof Error ? err.message : err);
    }
  }

  return result;
}
