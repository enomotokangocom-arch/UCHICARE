import { prisma } from "./prisma";
import { NOTIFICATION_TYPES } from "./constants";

interface RecordEventInput {
  candidateId: string;
  type: string;
  label?: string;
  payload?: unknown;
  actorType?: "SYSTEM" | "STAFF" | "CANDIDATE";
  actorStaffId?: string | null;
}

/**
 * 候補者の行動・スタッフ対応をタイムラインに記録し、
 * 対応する Lead Score ルールがあればスコアを加算、
 * 閾値を超えた場合は Lead Status (Cold/Warm/Hot) を自動更新します。
 */
export async function recordCandidateEvent(input: RecordEventInput) {
  const rule = await prisma.leadScoreRule.findUnique({ where: { actionCode: input.type } });
  const scoreDelta = rule?.isActive ? rule.points : 0;

  const event = await prisma.candidateEvent.create({
    data: {
      candidateId: input.candidateId,
      type: input.type,
      label: input.label ?? rule?.label,
      payload: input.payload !== undefined ? JSON.stringify(input.payload) : null,
      scoreDelta,
      actorType: input.actorType ?? "SYSTEM",
      actorStaffId: input.actorStaffId ?? null,
    },
  });

  if (scoreDelta !== 0) {
    await updateLeadScore(input.candidateId, scoreDelta);
  }

  await maybeCreateActionNotification(input.candidateId, input.type);

  return event;
}

async function updateLeadScore(candidateId: string, delta: number) {
  const candidate = await prisma.candidate.update({
    where: { id: candidateId },
    data: { leadScore: { increment: delta } },
  });

  const config = await getLeadScoreConfig();
  const newStatus =
    candidate.leadScore >= config.hotThreshold
      ? "LEAD_HOT"
      : candidate.leadScore >= config.warmThreshold
        ? "LEAD_WARM"
        : "LEAD_COLD";

  if (newStatus !== candidate.leadStatus) {
    await prisma.candidate.update({ where: { id: candidateId }, data: { leadStatus: newStatus } });
    await prisma.candidateEvent.create({
      data: {
        candidateId,
        type: "LEAD_STATUS_CHANGE",
        label: `温度変化: ${candidate.leadStatus} → ${newStatus}`,
        payload: JSON.stringify({ from: candidate.leadStatus, to: newStatus, score: candidate.leadScore }),
        actorType: "SYSTEM",
      },
    });

    if (newStatus === "LEAD_HOT") {
      await createNotification({
        type: NOTIFICATION_TYPES.HOT_TRANSITION,
        candidateId,
        title: "候補者がHOTになりました",
        body: `スコア ${candidate.leadScore} 点でHOTに変化しました。`,
      });
    }
  }
}

export async function getLeadScoreConfig() {
  const config = await prisma.leadScoreConfig.findFirst();
  if (config) return config;
  return prisma.leadScoreConfig.create({ data: {} });
}

export async function changeCandidateStage(
  candidateId: string,
  newStage: string,
  actor: { staffId?: string | null; actorType?: "SYSTEM" | "STAFF" }
) {
  const candidate = await prisma.candidate.findUniqueOrThrow({ where: { id: candidateId } });
  if (candidate.stage === newStage) return candidate;

  const updated = await prisma.candidate.update({
    where: { id: candidateId },
    data: { stage: newStage as never },
  });

  await prisma.candidateEvent.create({
    data: {
      candidateId,
      type: "STAGE_CHANGE",
      label: `ステージ変更: ${candidate.stage} → ${newStage}`,
      payload: JSON.stringify({ from: candidate.stage, to: newStage }),
      actorType: actor.actorType ?? "STAFF",
      actorStaffId: actor.staffId ?? null,
    },
  });

  return updated;
}

async function maybeCreateActionNotification(candidateId: string, type: string) {
  const map: Record<string, { type: string; title: string }> = {
    ACT_CASUAL: { type: NOTIFICATION_TYPES.CASUAL_REQUEST, title: "カジュアル面談の希望がありました" },
    ACT_VISIT: { type: NOTIFICATION_TYPES.VISIT_REQUEST, title: "事業所見学の希望がありました" },
    ACT_APPLY: { type: NOTIFICATION_TYPES.APPLICATION, title: "応募がありました" },
    ACT_QUESTION: { type: NOTIFICATION_TYPES.LINE_QUESTION, title: "LINEで質問がありました" },
  };
  const config = map[type];
  if (!config) return;
  await createNotification({ type: config.type, candidateId, title: config.title });
}

interface CreateNotificationInput {
  type: string;
  candidateId?: string | null;
  title: string;
  body?: string;
  payload?: unknown;
}

export async function createNotification(input: CreateNotificationInput) {
  const notification = await prisma.notification.create({
    data: {
      type: input.type,
      candidateId: input.candidateId ?? null,
      title: input.title,
      body: input.body,
      payload: input.payload !== undefined ? JSON.stringify(input.payload) : null,
    },
  });

  // 通知プロバイダーへ配信 (将来: メール / Slack / LINE WORKS)
  const { dispatchNotification } = await import("./notifications");
  await dispatchNotification(notification);

  return notification;
}
