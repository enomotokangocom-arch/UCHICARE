import { prisma } from "./prisma";
import { pushMessage, type LineMessage, type LineQuickReply } from "./line/client";
import { recordCandidateEvent } from "./events";

interface StepBody {
  text: string;
  cta?: Array<{ label: string; type: "postback" | "uri"; value: string }>;
}

function buildMessages(body: StepBody): LineMessage[] {
  let quickReply: LineQuickReply | undefined;
  if (body.cta && body.cta.length > 0) {
    quickReply = {
      items: body.cta
        .filter((c) => c.type === "postback")
        .slice(0, 13)
        .map((c) => ({
          type: "action",
          action: { type: "postback", label: c.label.slice(0, 20), data: c.value, displayText: c.label },
        })),
    };
  }
  return [{ type: "text", text: body.text, quickReply }];
}

const DAY_MS = 24 * 60 * 60 * 1000;

export interface StepSequenceRunResult {
  candidatesProcessed: number;
  messagesSent: number;
  errors: number;
}

/**
 * 友だち追加日を起点とした30日間ステップ配信を進行させます。
 * Day0はLINE Webhook側(follow時)で即時送信されるため、ここでは day > 0 のみ対象とします。
 * Vercel Cron等から1日1回以上呼び出すことを想定しています。
 */
export async function runStepSequenceDelivery(): Promise<StepSequenceRunResult> {
  const result: StepSequenceRunResult = { candidatesProcessed: 0, messagesSent: 0, errors: 0 };

  const candidates = await prisma.candidate.findMany({
    where: {
      isBlocked: false,
      deletedAt: null,
      stepSequenceId: { not: null },
      stepSequenceStartedAt: { not: null },
      lineUserId: { not: null },
    },
    include: { occupation: true },
  });

  for (const candidate of candidates) {
    result.candidatesProcessed += 1;
    if (!candidate.stepSequenceStartedAt || !candidate.stepSequenceId || !candidate.lineUserId) continue;

    const daysSinceStart = Math.floor((Date.now() - candidate.stepSequenceStartedAt.getTime()) / DAY_MS);

    const dueSteps = await prisma.stepMessage.findMany({
      where: {
        stepSequenceId: candidate.stepSequenceId,
        isActive: true,
        dayOffset: { lte: daysSinceStart, gt: 0 },
      },
      include: { occupations: true },
      orderBy: { dayOffset: "asc" },
    });

    // 同じ日に複数候補がある場合、職種特化メッセージを優先し、なければ全職種共通メッセージを採用
    const byDay = new Map<number, typeof dueSteps>();
    for (const step of dueSteps) {
      const list = byDay.get(step.dayOffset) ?? [];
      list.push(step);
      byDay.set(step.dayOffset, list);
    }

    for (const [, steps] of byDay) {
      const occCode = candidate.occupation?.code;
      const specific = occCode
        ? steps.filter((s) => s.occupations.some((o) => o.occupationId === candidate.occupationId))
        : [];
      const candidates2 = specific.length > 0 ? specific : steps.filter((s) => s.occupations.length === 0);

      for (const step of candidates2) {
        const alreadySent = await prisma.candidateStepProgress.findUnique({
          where: { candidateId_stepMessageId: { candidateId: candidate.id, stepMessageId: step.id } },
        });
        if (alreadySent) continue;

        try {
          const body: StepBody = JSON.parse(step.body);
          await pushMessage(candidate.lineUserId, buildMessages(body));
          await prisma.candidateStepProgress.create({
            data: { candidateId: candidate.id, stepMessageId: step.id },
          });
          await recordCandidateEvent({
            candidateId: candidate.id,
            type: "STEP_MESSAGE_SENT",
            label: `ステップ配信: Day${step.dayOffset} ${step.title}`,
          });
          result.messagesSent += 1;
        } catch (err) {
          result.errors += 1;
          console.error("Step message send failed", err instanceof Error ? err.message : err);
        }
      }
    }
  }

  return result;
}
