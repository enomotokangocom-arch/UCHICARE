import { prisma } from "../prisma";
import { recordCandidateEvent, changeCandidateStage, createNotification } from "../events";
import { replyMessage, pushMessage, getUserProfile, type LineMessage } from "./client";
import { OCCUPATION_LABELS, TRANSFER_TIMING_LABELS, NOTIFICATION_TYPES } from "../constants";

type QuickReplyItem = { label: string; data: string };

function textWithQuickReply(text: string, items: QuickReplyItem[]): LineMessage {
  return {
    type: "text",
    text,
    quickReply: {
      items: items.slice(0, 13).map((item) => ({
        type: "action",
        action: { type: "postback", label: item.label.slice(0, 20), data: item.data, displayText: item.label },
      })),
    },
  };
}

async function safeReply(replyToken: string | null, to: string, messages: LineMessage[]) {
  try {
    if (replyToken) {
      await replyMessage(replyToken, messages);
    } else {
      await pushMessage(to, messages);
    }
  } catch (err) {
    console.error("LINE send failed", err instanceof Error ? err.message : err);
  }
}

async function findOrCreateCandidate(lineUserId: string) {
  let candidate = await prisma.candidate.findUnique({ where: { lineUserId } });
  if (!candidate) {
    let displayName: string | undefined;
    try {
      const profile = await getUserProfile(lineUserId);
      displayName = profile?.displayName;
    } catch {
      // LINE未設定時などは無視して進める
    }
    const defaultSequence = await prisma.stepSequence.findFirst({ where: { isActive: true } });
    candidate = await prisma.candidate.create({
      data: {
        lineUserId,
        lineDisplayName: displayName,
        stepSequenceId: defaultSequence?.id,
        stepSequenceStartedAt: new Date(),
        stepSequenceDay: 0,
        onboardingState: "ASK_OCCUPATION",
      },
    });
  } else if (candidate.isBlocked) {
    candidate = await prisma.candidate.update({
      where: { id: candidate.id },
      data: {
        isBlocked: false,
        blockedAt: null,
        stepSequenceStartedAt: new Date(),
        stepSequenceDay: 0,
        onboardingState: "ASK_OCCUPATION",
      },
    });
  }
  return candidate;
}

export async function handleFollow(lineUserId: string, replyToken: string | null) {
  const candidate = await findOrCreateCandidate(lineUserId);
  await recordCandidateEvent({ candidateId: candidate.id, type: "LINE_FOLLOW", label: "LINE友だち登録" });
  await prisma.candidate.update({ where: { id: candidate.id }, data: { lastLineReactionAt: new Date() } });

  await safeReply(replyToken, lineUserId, [
    {
      type: "text",
      text:
        "Uchi careの採用公式LINEに友だち追加いただきありがとうございます!\n" +
        "今後、会社の情報やスタッフの声、求人情報などをお届けします。\n\n" +
        "まずは簡単な質問にご協力ください。あなたの職種を教えてください。",
    },
    textWithQuickReply("職種を選択してください", [
      { label: "看護師", data: "ONBOARD_OCC:JOB_NS" },
      { label: "PT・OT・ST", data: "ONBOARD_OCC:RIHA_GROUP" },
      { label: "ケアマネ", data: "ONBOARD_OCC:JOB_CM" },
      { label: "その他", data: "ONBOARD_OCC:JOB_OTHER" },
    ]),
  ]);
}

export async function handleUnfollow(lineUserId: string) {
  const candidate = await prisma.candidate.findUnique({ where: { lineUserId } });
  if (!candidate) return;
  await prisma.candidate.update({ where: { id: candidate.id }, data: { isBlocked: true, blockedAt: new Date() } });
  await recordCandidateEvent({ candidateId: candidate.id, type: "LINE_UNFOLLOW", label: "LINEブロック" });
}

const TIMING_OPTIONS: Array<{ label: string; code: string }> = Object.entries(TRANSFER_TIMING_LABELS).map(
  ([code, label]) => ({ code, label })
);

async function askTiming(lineUserId: string, replyToken: string | null) {
  await safeReply(replyToken, lineUserId, [
    textWithQuickReply(
      "現在の転職について、一番近いものを教えてください",
      TIMING_OPTIONS.map((t) => ({ label: t.label, data: `ONBOARD_TIMING:${t.code}` }))
    ),
  ]);
}

async function askArea(lineUserId: string, replyToken: string | null) {
  const areas = await prisma.area.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
  await safeReply(replyToken, lineUserId, [
    textWithQuickReply(
      "希望エリアを教えてください",
      areas.map((a) => ({ label: a.name, data: `ONBOARD_AREA:${a.id}` }))
    ),
  ]);
}

async function askRihaDetail(lineUserId: string, replyToken: string | null) {
  await safeReply(replyToken, lineUserId, [
    textWithQuickReply("差し支えなければ、詳しい職種を教えてください", [
      { label: "理学療法士(PT)", data: "ONBOARD_OCC:JOB_PT" },
      { label: "作業療法士(OT)", data: "ONBOARD_OCC:JOB_OT" },
      { label: "言語聴覚士(ST)", data: "ONBOARD_OCC:JOB_ST" },
    ]),
  ]);
}

async function completeOnboarding(lineUserId: string, replyToken: string | null) {
  await safeReply(replyToken, lineUserId, [
    {
      type: "text",
      text: "ご回答ありがとうございました!今後、あなたに合った情報を定期的にお届けします。楽しみにお待ちください。",
    },
  ]);
}

export async function handlePostback(lineUserId: string, data: string, replyToken: string | null) {
  const candidate = await prisma.candidate.findUnique({ where: { lineUserId } });
  if (!candidate) return;

  await prisma.candidate.update({ where: { id: candidate.id }, data: { lastLineReactionAt: new Date() } });
  await recordCandidateEvent({ candidateId: candidate.id, type: "ACT_LINE_REPLY", label: "LINEアクション" });

  const [key, value] = data.split(":");

  if (key === "ONBOARD_OCC") {
    if (value === "RIHA_GROUP") {
      await prisma.candidate.update({ where: { id: candidate.id }, data: { onboardingState: "ASK_RIHA_DETAIL" } });
      await askRihaDetail(lineUserId, replyToken);
      return;
    }
    const occupation = await prisma.occupation.findUnique({ where: { code: value } });
    await prisma.candidate.update({
      where: { id: candidate.id },
      data: { occupationId: occupation?.id, onboardingState: "ASK_TIMING" },
    });
    await recordCandidateEvent({
      candidateId: candidate.id,
      type: "OCCUPATION_SET",
      label: `職種選択: ${OCCUPATION_LABELS[value] ?? value}`,
      actorType: "CANDIDATE",
    });
    await askTiming(lineUserId, replyToken);
    return;
  }

  if (key === "ONBOARD_TIMING") {
    await prisma.candidate.update({
      where: { id: candidate.id },
      data: { transferTiming: value as never, onboardingState: "ASK_AREA" },
    });
    await recordCandidateEvent({
      candidateId: candidate.id,
      type: "TIMING_SET",
      label: `転職時期: ${TRANSFER_TIMING_LABELS[value] ?? value}`,
      actorType: "CANDIDATE",
    });
    await askArea(lineUserId, replyToken);
    return;
  }

  if (key === "ONBOARD_AREA") {
    const area = await prisma.area.findUnique({ where: { id: value } });
    await prisma.candidate.update({
      where: { id: candidate.id },
      data: { areaId: value, onboardingState: null },
    });
    await recordCandidateEvent({
      candidateId: candidate.id,
      type: "AREA_SET",
      label: `希望エリア: ${area?.name ?? value}`,
      actorType: "CANDIDATE",
    });
    await completeOnboarding(lineUserId, replyToken);
    return;
  }

  if (key === "REHEARING") {
    const previousTiming = candidate.transferTiming;
    await prisma.candidate.update({
      where: { id: candidate.id },
      data: { transferTiming: value as never, lastRehearingSentAt: new Date() },
    });
    await recordCandidateEvent({
      candidateId: candidate.id,
      type: "REHEARING_ANSWER",
      label: `再ヒアリング回答: ${TRANSFER_TIMING_LABELS[value] ?? value}`,
      payload: { previous: previousTiming, next: value },
      actorType: "CANDIDATE",
    });
    await safeReply(replyToken, lineUserId, [{ type: "text", text: "ご回答ありがとうございました。" }]);
    return;
  }

  if (key === "CTA_CASUAL") {
    await recordCandidateEvent({ candidateId: candidate.id, type: "ACT_CASUAL", actorType: "CANDIDATE" });
    await changeCandidateStage(candidate.id, "CASUAL", { actorType: "SYSTEM" });
    await safeReply(replyToken, lineUserId, [
      { type: "text", text: "ありがとうございます!担当者よりLINEまたはお電話でご連絡いたします。" },
    ]);
    return;
  }

  if (key === "CTA_VISIT") {
    await recordCandidateEvent({ candidateId: candidate.id, type: "ACT_VISIT", actorType: "CANDIDATE" });
    await changeCandidateStage(candidate.id, "VISIT", { actorType: "SYSTEM" });
    await safeReply(replyToken, lineUserId, [
      { type: "text", text: "ありがとうございます!事業所見学の日程について担当者よりご連絡いたします。" },
    ]);
    return;
  }

  if (key === "CTA_JOB_INFO") {
    await recordCandidateEvent({ candidateId: candidate.id, type: "ACT_JOB_VIEW", actorType: "CANDIDATE" });
    await safeReply(replyToken, lineUserId, [
      { type: "text", text: "求人情報はリッチメニューの「求人情報」からいつでもご覧いただけます。" },
    ]);
    return;
  }

  if (key === "CTA_RESEARCH") {
    await recordCandidateEvent({ candidateId: candidate.id, type: "CTA_RESEARCH_CLICK", actorType: "CANDIDATE" });
    await safeReply(replyToken, lineUserId, [
      { type: "text", text: "承知いたしました。引き続き、お役立ち情報をお届けします。" },
    ]);
    return;
  }

  if (key === "CASUAL_VISIT_MENU") {
    await safeReply(replyToken, lineUserId, [
      textWithQuickReply("ご希望を選択してください", [
        { label: "まず話を聞いてみたい", data: "CTA_CASUAL" },
        { label: "事業所を見学したい", data: "CTA_VISIT" },
      ]),
    ]);
    return;
  }

  if (key === "QUESTION_MENU") {
    await safeReply(replyToken, lineUserId, [
      { type: "text", text: "ご質問があれば、このままメッセージを送ってください。担当者が確認してご連絡します。" },
    ]);
    return;
  }
}

export async function handleTextMessage(lineUserId: string, text: string, replyToken: string | null) {
  const candidate = await prisma.candidate.findUnique({ where: { lineUserId } });
  if (!candidate) return;

  await prisma.candidate.update({ where: { id: candidate.id }, data: { lastLineReactionAt: new Date() } });
  await recordCandidateEvent({
    candidateId: candidate.id,
    type: "ACT_QUESTION",
    label: "LINEで質問",
    payload: { text: text.slice(0, 500) },
    actorType: "CANDIDATE",
  });

  await createNotification({
    type: NOTIFICATION_TYPES.LINE_QUESTION,
    candidateId: candidate.id,
    title: "LINEで質問がありました",
    body: text.slice(0, 200),
  });

  await safeReply(replyToken, lineUserId, [
    { type: "text", text: "メッセージありがとうございます!担当者が内容を確認し、追ってご連絡いたします。" },
  ]);
}
