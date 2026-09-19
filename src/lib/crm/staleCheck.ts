import { prisma } from "./prisma";
import { createNotification } from "./events";
import { NOTIFICATION_TYPES, STALE_CANDIDATE_DAYS } from "./constants";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * HOT/WARM候補者のうち、スタッフが一定期間対応していない候補者に通知を出します。
 * 同一候補者への重複通知を避けるため、直近未読のSTALE_CANDIDATE通知が既にあればスキップします。
 */
export async function runStaleCandidateCheck() {
  const threshold = new Date(Date.now() - STALE_CANDIDATE_DAYS * DAY_MS);

  const candidates = await prisma.candidate.findMany({
    where: {
      deletedAt: null,
      isBlocked: false,
      leadStatus: { in: ["LEAD_WARM", "LEAD_HOT"] },
      OR: [{ lastStaffContactAt: { lt: threshold } }, { lastStaffContactAt: null }],
      registeredAt: { lt: threshold },
    },
  });

  let created = 0;
  for (const candidate of candidates) {
    const existing = await prisma.notification.findFirst({
      where: { candidateId: candidate.id, type: NOTIFICATION_TYPES.STALE_CANDIDATE, readAt: null },
    });
    if (existing) continue;

    await createNotification({
      type: NOTIFICATION_TYPES.STALE_CANDIDATE,
      candidateId: candidate.id,
      title: `${STALE_CANDIDATE_DAYS}日以上未対応の候補者があります`,
    });
    created += 1;
  }

  return { checked: candidates.length, created };
}
