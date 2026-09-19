import { prisma } from "./prisma";
import { pushMessage } from "./line/client";
import type { Campaign } from "@prisma/client";

function parseJsonArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export async function resolveCampaignAudience(campaign: Campaign) {
  const occupations = parseJsonArray(campaign.targetOccupations);
  const timings = parseJsonArray(campaign.targetTimings);
  const areas = parseJsonArray(campaign.targetAreas);
  const leadStatuses = parseJsonArray(campaign.targetLeadStatuses);
  const stages = parseJsonArray(campaign.targetStages);

  const where: Record<string, unknown> = { deletedAt: null, isBlocked: false, lineUserId: { not: null } };
  if (occupations.length > 0) where.occupation = { code: { in: occupations } };
  if (timings.length > 0) where.transferTiming = { in: timings };
  if (areas.length > 0) where.areaId = { in: areas };
  if (leadStatuses.length > 0) where.leadStatus = { in: leadStatuses };
  if (stages.length > 0) where.stage = { in: stages };

  return prisma.candidate.findMany({ where, select: { id: true, lineUserId: true } });
}

export interface SendCampaignResult {
  total: number;
  sent: number;
  failed: number;
}

/**
 * 承認済み(APPROVED/SCHEDULED)キャンペーンを配信します。
 * 誤配信防止のため、DRAFT/REVIEW状態のキャンペーンは送信できません。
 */
export async function sendCampaign(campaignId: string): Promise<SendCampaignResult> {
  const campaign = await prisma.campaign.findUniqueOrThrow({ where: { id: campaignId } });

  if (campaign.status !== "APPROVED" && campaign.status !== "SCHEDULED") {
    throw new Error("承認済みのキャンペーンのみ配信できます。");
  }

  const audience = await resolveCampaignAudience(campaign);

  // 配信対象をスナップショットとして保存 (後から対象条件が変わっても配信実績は固定)
  // skipDuplicatesはSQLite未対応のため、upsertで冪等に登録する。
  for (const c of audience) {
    await prisma.campaignAudience.upsert({
      where: { campaignId_candidateId: { campaignId, candidateId: c.id } },
      update: {},
      create: { campaignId, candidateId: c.id },
    });
  }

  const result: SendCampaignResult = { total: audience.length, sent: 0, failed: 0 };

  for (const candidate of audience) {
    if (!candidate.lineUserId) continue;
    try {
      await pushMessage(candidate.lineUserId, [
        {
          type: "text",
          text: campaign.ctaLabel && campaign.ctaUrl ? `${campaign.body}\n\n▼${campaign.ctaLabel}\n${campaign.ctaUrl}` : campaign.body,
        },
      ]);
      await prisma.campaignDelivery.upsert({
        where: { campaignId_candidateId: { campaignId, candidateId: candidate.id } },
        update: { status: "SENT", sentAt: new Date() },
        create: { campaignId, candidateId: candidate.id, status: "SENT", sentAt: new Date() },
      });
      result.sent += 1;
    } catch (err) {
      await prisma.campaignDelivery.upsert({
        where: { campaignId_candidateId: { campaignId, candidateId: candidate.id } },
        update: { status: "FAILED", error: err instanceof Error ? err.message : "unknown error" },
        create: {
          campaignId,
          candidateId: candidate.id,
          status: "FAILED",
          error: err instanceof Error ? err.message : "unknown error",
        },
      });
      result.failed += 1;
    }
  }

  await prisma.campaign.update({ where: { id: campaignId }, data: { status: "SENT", sentAt: new Date() } });

  return result;
}

/** scheduledAt が到来したSCHEDULEDキャンペーンをまとめて配信する (Cron用) */
export async function dispatchDueCampaigns() {
  const due = await prisma.campaign.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: new Date() } },
  });

  const results = [];
  for (const campaign of due) {
    try {
      const result = await sendCampaign(campaign.id);
      results.push({ campaignId: campaign.id, ...result });
    } catch (err) {
      results.push({ campaignId: campaign.id, error: err instanceof Error ? err.message : "unknown error" });
    }
  }
  return results;
}
